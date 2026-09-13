CREATE TABLE "telemetry_messages" (
  "device_id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "event_at" TIMESTAMPTZ(6) NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telemetry_messages_pkey" PRIMARY KEY ("device_id", "message_id"),
  CONSTRAINT "telemetry_messages_device_id_fkey" FOREIGN KEY ("device_id")
    REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "devices_household_id_id_idx" ON "devices"("household_id", "id");
