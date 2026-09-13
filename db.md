-- ============================================================================
-- DATABASE SCHEMA - MO HINH NHA IOT (Smart Home IoT Project)
-- PostgreSQL 14+ (PostgreSQL thuan du cho pham vi do an/solo project)
-- ============================================================================
-- ACTIVE MVP SCOPE:
-- users, refresh_sessions, households, household_members (owner flow only),
-- devices, device_states, device_commands, sensor_readings, action_logs,
-- alerts, notifications, and fcm_tokens.
--
-- DEFERRED:
-- OTP/Google auth, invitations and advanced RBAC UI, schedules, rules, scenes,
-- analytics, habit suggestions, and chatbot features. Deferred tables are kept
-- as a future reference; do not build their APIs or UI before MVP completion.
-- ============================================================================
-- Ghi chu: du an dung PostgreSQL thuan. Bang sensor_readings co composite index
-- theo device/metric/thoi gian; chi can partition khi du lieu tang rat lon.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. NGUOI DUNG & TAI KHOAN  (chuc nang 1, 14)
-- ============================================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255),          -- NULL neu dang nhap chi bang Google
    auth_provider   VARCHAR(20) NOT NULL DEFAULT 'local'
                    CHECK (auth_provider IN ('local', 'google', 'otp')),
    google_id       VARCHAR(100) UNIQUE,
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (                  -- xac thuc OTP khi dang nhap/dang ky
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    destination     VARCHAR(150) NOT NULL, -- email hoac so dien thoai nhan OTP
    code_hash       VARCHAR(255) NOT NULL,
    purpose         VARCHAR(30) NOT NULL
                    CHECK (purpose IN ('login', 'register', 'reset_password')),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_used         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fcm_tokens (                 -- token push notification (chuc nang 6)
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL,
    platform        VARCHAR(20) NOT NULL DEFAULT 'android'
                    CHECK (platform IN ('android', 'ios', 'web')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, token)
);

-- ============================================================================
-- 2. HO GIA DINH & PHAN QUYEN  (chuc nang 11)
-- ============================================================================

CREATE TABLE households (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,      -- vd: "Nha cua An"
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'member', 'guest')),
    invited_by      UUID REFERENCES users(id),
    expires_at      TIMESTAMPTZ,                -- danh cho tai khoan khach tam thoi
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (household_id, user_id)
);

-- ============================================================================
-- 3. THIET BI  (chuc nang 2, 8, 9 bao mat)
-- ============================================================================

CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    device_uid      VARCHAR(100) UNIQUE NOT NULL,  -- ma dinh danh phan cung (vd MAC)
    name            VARCHAR(100) NOT NULL,          -- vd: "Den phong khach"
    device_type     VARCHAR(30) NOT NULL
                    CHECK (device_type IN ('light', 'fan', 'door_servo',
                                           'dht_sensor', 'gas_sensor', 'fire_sensor')),
    room            VARCHAR(50),                     -- vi tri: "Phong khach", "Bep"...
    mqtt_topic      VARCHAR(150) UNIQUE NOT NULL,    -- topic goc: home/{household_id}/device/{id}
    auth_token_hash VARCHAR(255) NOT NULL,           -- token/cert de thiet bi xac thuc voi broker
    firmware_version VARCHAR(30),
    is_online       BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE device_states (              -- trang thai hien tai cua thiet bi (cache nhanh)
    device_id       UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    state           JSONB NOT NULL DEFAULT '{}',  -- vd: {"power": "on", "brightness": 80}
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL,
    user_agent      VARCHAR(255),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_sessions_user_expiry
    ON refresh_sessions (user_id, expires_at);

-- Theo doi vong doi lenh MQTT va ACK tu thiet bi. action_logs chi luu ket qua audit.
CREATE TABLE device_commands (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    command         JSONB NOT NULL,
    source          VARCHAR(20) NOT NULL DEFAULT 'app'
                    CHECK (source IN ('app', 'schedule', 'rule', 'scene', 'chatbot', 'voice')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'acknowledged', 'succeeded', 'failed', 'timeout')),
    error_message   TEXT,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_device_commands_device_time
    ON device_commands (device_id, requested_at DESC);
CREATE INDEX idx_device_commands_pending
    ON device_commands (status, requested_at)
    WHERE status IN ('pending', 'sent', 'acknowledged');

-- ============================================================================
-- 4. DU LIEU CAM BIEN  (chuc nang 3) -- bang time-series, du lieu lon
-- ============================================================================

CREATE TABLE sensor_readings (
    id              BIGSERIAL PRIMARY KEY,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric          VARCHAR(30) NOT NULL,   -- 'temperature' | 'humidity' | 'gas_level'
    value           NUMERIC(10,2) NOT NULL,
    unit            VARCHAR(10),            -- '°C' | '%' | 'ppm'
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sensor_readings_device_metric_time
    ON sensor_readings (device_id, metric, recorded_at DESC);

-- ============================================================================
-- 5. LICH SU HANH DONG / LOG  (chuc nang 7)
-- ============================================================================

CREATE TABLE action_logs (
    id              BIGSERIAL PRIMARY KEY,
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL neu tu dong
    action          VARCHAR(50) NOT NULL,                -- 'turn_on' | 'turn_off' | 'open_door'...
    source          VARCHAR(20) NOT NULL
                    CHECK (source IN ('app', 'schedule', 'rule', 'scene', 'chatbot', 'voice')),
    old_value       JSONB,
    new_value       JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_logs_household_time
    ON action_logs (household_id, created_at DESC);
CREATE INDEX idx_action_logs_device_time
    ON action_logs (device_id, created_at DESC);

-- ============================================================================
-- 6. CANH BAO & THONG BAO  (chuc nang 6)
-- ============================================================================

CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    alert_type      VARCHAR(30) NOT NULL,    -- 'fire' | 'gas' | 'device_offline' | 'humidity_high'
    severity        VARCHAR(20) NOT NULL
                    CHECK (severity IN ('info', 'warning', 'critical')),
    message         TEXT NOT NULL,
    is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (is_acknowledged = FALSE AND acknowledged_at IS NULL) OR
        (is_acknowledged = TRUE AND acknowledged_at IS NOT NULL)
    )
);

CREATE INDEX idx_alerts_household_time
    ON alerts (household_id, created_at DESC);

CREATE TABLE notifications (              -- ban ghi tung thong bao da gui toi tung user
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id        UUID REFERENCES alerts(id) ON DELETE CASCADE,
    title           VARCHAR(150) NOT NULL,
    body            TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    fcm_message_id  VARCHAR(150),
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    sent_at         TIMESTAMPTZ,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_time
    ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread
    ON notifications (user_id, created_at DESC)
    WHERE is_read = FALSE;

-- ============================================================================
-- 7. HEN GIO  (chuc nang 5)
-- ============================================================================

CREATE TABLE schedules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    action          JSONB NOT NULL,           -- vd: {"power": "on"}
    time_of_day     TIME NOT NULL,             -- vd: 18:00:00
    repeat_days     SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}', -- 1=Thu2 ... 7=CN
    timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    next_run_at     TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (repeat_days <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[])
);

-- ============================================================================
-- 8. RULE ENGINE (IF-THEN)  (chuc nang 10)
-- ============================================================================

CREATE TABLE rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,     -- vd: "Bat quat khi nong"
    condition       JSONB NOT NULL,             -- vd: {"metric":"temperature","operator":">","value":30,"device_id":"..."}
    action          JSONB NOT NULL,             -- vd: {"device_id":"...","action":"turn_on"}
    priority        SMALLINT NOT NULL DEFAULT 0,-- so lon hon = uu tien xu ly truoc khi trung dieu kien
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. SCENE / KICH BAN  (chuc nang 12)
-- ============================================================================

CREATE TABLE scenes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,      -- vd: "Di ngu", "Ra khoi nha"
    icon            VARCHAR(50),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scene_actions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id        UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    action          JSONB NOT NULL,             -- vd: {"power": "off"}
    order_index     SMALLINT NOT NULL DEFAULT 0 -- thu tu thuc hien trong scene
);

-- ============================================================================
-- 10. THONG KE / DASHBOARD  (chuc nang 13)
-- ============================================================================
-- Khong can bang rieng — dashboard tinh toan truc tiep tu action_logs va
-- sensor_readings bang query aggregation (COUNT, SUM, GROUP BY ngay/tuan).
-- Vi du view thong ke so lan bat/tat thiet bi theo ngay:

CREATE VIEW v_device_actions_daily AS
SELECT
    device_id,
    date_trunc('day', created_at) AS day,
    action,
    COUNT(*) AS total_times
FROM action_logs
GROUP BY device_id, date_trunc('day', created_at), action;

-- ============================================================================
-- 11. GOI Y TU DONG HOA (HOC THOI QUEN)  (chuc nang 17)
-- ============================================================================

CREATE TABLE habit_suggestions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    pattern_description TEXT NOT NULL,     -- vd: "Ban thuong bat den luc 18h moi ngay"
    suggested_action    JSONB NOT NULL,     -- vd: {"time":"18:00","action":{"power":"on"}}
    confidence_score     NUMERIC(4,2) CHECK (confidence_score BETWEEN 0 AND 1),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'dismissed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. CHATBOT (Telegram/Zalo)  (chuc nang 15)
-- ============================================================================

CREATE TABLE chatbot_links (              -- lien ket tai khoan app voi chat id tren Telegram/Zalo
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        VARCHAR(20) NOT NULL,   -- 'telegram' | 'zalo'
    chat_id         VARCHAR(100) NOT NULL,
    linked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform, chat_id)
);

-- ============================================================================
-- GHI CHU THIET KE
-- ============================================================================
-- 1) Moi bang du lieu deu gan voi household_id (truc tiep hoac gian tiep qua
--    device_id) de dam bao co lap du lieu giua cac nha khac nhau khi mo rong
--    nhieu ho gia dinh dung chung he thong.
-- 2) condition/action trong "rules" va "schedules" dung JSONB de linh hoat,
--    khong can sua schema khi them loai dieu kien/hanh dong moi.
-- 3) sensor_readings tach rieng khoi action_logs vi ban chat du lieu khac nhau:
--    sensor_readings la du lieu do dac lien tuc (nhieu), action_logs la su
--    kien roi rac (it hon, quan trong hon ve mat audit).
-- 4) Backend phai kiem tra device_id, requested_by/created_by thuoc dung household;
--    cac khoa ngoai rieng le khong tu dam bao rang buoc cheo nay.
-- 5) updated_at can duoc cap nhat boi backend/Prisma middleware hoac DB trigger.
-- ============================================================================
-- Sprint 1 implementation addition (2026-09-14): durable per-device deduplication.
-- event_at is device time; received_at and sensor_readings.recorded_at use server time.
-- Each accepted DHT message inserts this record and two sensor readings, and updates
-- device last_seen_at atomically. Duplicate messages do not extend online status.
CREATE TABLE telemetry_messages (
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    message_id UUID NOT NULL,
    event_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, message_id)
);
CREATE INDEX devices_household_id_id_idx ON devices(household_id, id);
-- Device API derives online state from last_seen_at and DEVICE_OFFLINE_AFTER_MS.
-- The backend also periodically expires the persisted is_online flag.
