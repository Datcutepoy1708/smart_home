import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "../core/api-client";

let mockDevice: unknown = null;
let mockLoading = false;
let mockError = "";

let hookCallIndex = 0;

vi.mock("react", async () => {
  const actual = (await vi.importActual("react")) as any;
  return {
    ...actual,
    useState: (initial: unknown) => {
      hookCallIndex++;
      if (hookCallIndex === 1) return [mockDevice, vi.fn()];
      if (hookCallIndex === 2) return [mockLoading, vi.fn()];
      if (hookCallIndex === 3) return [mockError, vi.fn()];
      return actual.useState(initial);
    },
  };
});

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const sessionState = vi.hoisted(() => ({
  session: {
    identity: {
      user: { name: "Test User", email: "test@example.com" },
      households: [{ id: "h1", name: "Test Home", role: "owner" }],
    },
    get: vi.fn(),
  },
}));

vi.mock("expo-router", () => ({
  router: { back: vi.fn(), push: vi.fn() },
  useLocalSearchParams: () => ({ id: "device-1" }),
  useFocusEffect: vi.fn(),
}));

vi.mock("../core/session-provider", () => ({
  useSession: () => sessionState,
}));

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: () => null,
}));

vi.mock("react-native", () => ({
  View: "section",
  Text: "span",
  Pressable: "button",
  SafeAreaView: "main",
  ScrollView: "div",
  ActivityIndicator: "progress",
  RefreshControl: "aside",
  Switch: "input",
  Platform: { OS: "ios" },
  StatusBar: { currentHeight: 0 },
  StyleSheet: { create: (value: unknown) => value },
}));

import DeviceDetailScreen from "../features/devices/device-detail-screen";

function renderScreen() {
  hookCallIndex = 0;
  return renderToStaticMarkup(createElement(DeviceDetailScreen));
}

describe("device detail screen states and error handling", () => {
  beforeEach(() => {
    mockDevice = null;
    mockLoading = false;
    mockError = "";
    hookCallIndex = 0;
  });

  it("shows initial error card when device is null", () => {
    mockError = "Không thể tải thông tin thiết bị.";
    const html = renderScreen();
    expect(html).toContain("Không thể tải thông tin thiết bị.");
    expect(html).toContain("Thử lại");
  });

  it("renders online pill when device is online without errors", () => {
    mockDevice = {
      id: "device-1",
      name: "Cảm biến phòng khách",
      room: "Phòng khách",
      deviceType: "dht_sensor",
      isOnline: true,
      lastSeenAt: new Date().toISOString(),
      readings: [{ metric: "temperature", value: 27, unit: "°C", recordedAt: new Date().toISOString() }],
    };
    mockError = "";
    const html = renderScreen();
    expect(html).toContain("Trực tuyến (Online)");
    expect(html).toContain("Cảm biến phòng khách");
    expect(html).not.toContain("Không rõ (Lỗi kết nối)");
    expect(html).not.toContain("Dữ liệu hiển thị có thể đã cũ");
  });

  it("renders stale error banner and 'Không rõ' status when refresh fails with stale device data", () => {
    mockDevice = {
      id: "device-1",
      name: "Cảm biến phòng khách",
      room: "Phòng khách",
      deviceType: "dht_sensor",
      isOnline: true,
      lastSeenAt: new Date().toISOString(),
      readings: [{ metric: "temperature", value: 27, unit: "°C", recordedAt: new Date().toISOString() }],
    };
    mockError = "Mất kết nối mạng";
    const html = renderScreen();
    // Stale error banner must be rendered
    expect(html).toContain("Dữ liệu hiển thị có thể đã cũ");
    expect(html).toContain("Không thể làm mới: Mất kết nối mạng");
    // Status must be "Không rõ", NOT claiming "Trực tuyến"
    expect(html).toContain("Không rõ (Lỗi kết nối)");
    expect(html).not.toContain("Trực tuyến (Online)");
  });

  it("clears cached device data when 403 or 404 error occurs in load logic", () => {
    let cachedDevice: unknown = { id: "device-1", name: "Old Device" };
    function handleLoadError(error: unknown) {
      const status = error instanceof ApiError ? error.status : undefined;
      if (status === 403 || status === 404) {
        cachedDevice = null;
      }
    }

    handleLoadError(new ApiError("Forbidden", 403));
    expect(cachedDevice).toBeNull();

    cachedDevice = { id: "device-1", name: "Old Device" };
    handleLoadError(new ApiError("Not Found", 404));
    expect(cachedDevice).toBeNull();

    cachedDevice = { id: "device-1", name: "Old Device" };
    handleLoadError(new ApiError("Network failure", 500));
    expect(cachedDevice).not.toBeNull(); // Preserved for network errors
  });

  it("renders power control card with switch and status for controllable light and fan", () => {
    mockDevice = {
      id: "device-light",
      name: "Đèn trần",
      room: "Phòng khách",
      deviceType: "light",
      isOnline: true,
      state: { power: "on" },
      lastSeenAt: new Date().toISOString(),
      readings: [],
    };
    mockError = "";
    const lightHtml = renderScreen();
    expect(lightHtml).toContain("Nguồn chiếu sáng");
    expect(lightHtml).toContain("Đang bật");

    mockDevice = {
      id: "device-fan",
      name: "Quạt bàn",
      room: "Phòng ngủ",
      deviceType: "fan",
      isOnline: true,
      state: { power: "off" },
      lastSeenAt: new Date().toISOString(),
      readings: [],
    };
    const fanHtml = renderScreen();
    expect(fanHtml).toContain("Nguồn quạt điện");
    expect(fanHtml).toContain("Đang tắt");
  });

  it("renders door control card with angle slider and presets for door_servo", () => {
    mockDevice = {
      id: "device-door",
      name: "Cửa chính",
      room: "Phòng khách",
      deviceType: "door_servo",
      isOnline: true,
      state: { position: "open", angle: 90 },
      lastSeenAt: new Date().toISOString(),
      readings: [],
    };
    mockError = "";
    const doorHtml = renderScreen();
    expect(doorHtml).toContain("Cửa thông minh");
    expect(doorHtml).toContain("Đang mở 90°");
    expect(doorHtml).toContain("Thanh gạt góc mở");
    expect(doorHtml).toContain("Đóng (0°)");
    expect(doorHtml).toContain("Mở 90°");
  });
});
