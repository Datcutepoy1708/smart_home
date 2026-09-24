import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  home: { id: "h1", name: "Test Home", role: "owner" },
  items: [] as unknown[],
  loading: false,
  error: "",
  refresh: () => {},
  more: null,
}));

const sessionState = vi.hoisted(() => ({
  session: { identity: { user: { name: "Test User", email: "t@t.com" }, households: [{ id: "h1", name: "Test Home", role: "owner" }] } },
}));

vi.mock("../features/devices/use-devices", () => ({ useDevices: () => state }));
vi.mock("../core/session-provider", () => ({ useSession: () => sessionState }));
vi.mock("expo-router", () => ({ router: { push: () => {}, back: () => {}, replace: () => {} } }));
vi.mock("../shared/components/screen-header", () => ({
  default: ({ title }: { title: string }) => createElement("header", null, title),
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
  TextInput: "input",
  Switch: "input",
  Modal: "div",
  Platform: { OS: "ios" },
  StyleSheet: { create: (value: unknown) => value },
}));

import DevicesScreen from "../features/devices/devices-screen";

describe("device screen states", () => {
  it("shows loading indicator without a misleading empty state", () => {
    state.loading = true;
    state.items = [];
    state.error = "";
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Đang tải thiết bị");
    expect(html).not.toContain("Chưa có thiết bị");
  });

  it("shows an empty household message", () => {
    state.loading = false;
    state.items = [];
    state.error = "";
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Chưa có thiết bị nào");
  });

  it("offers retry on a network error", () => {
    state.loading = false;
    state.items = [];
    state.error = "Unable to connect";
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Unable to connect");
    expect(html).toContain("Thử lại");
  });

  it("shows offline status and latest sensor values", () => {
    state.loading = false;
    state.error = "";
    state.items = [
      {
        id: "one",
        name: "Sensor",
        room: null,
        deviceType: "sensor",
        isOnline: false,
        lastSeenAt: null,
        readings: [{ metric: "humidity", value: 67, unit: "%", recordedAt: new Date().toISOString() }],
      },
    ];
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Ngoại tuyến");
    expect(html).toContain("67 %");
  });

  it("renders interactive switch for light and fan devices", () => {
    state.loading = false;
    state.error = "";
    state.items = [
      {
        id: "light-1",
        name: "Đèn phòng khách",
        room: "Phòng khách",
        deviceType: "light",
        isOnline: true,
        state: { power: "on" },
        lastSeenAt: new Date().toISOString(),
        readings: [],
      },
      {
        id: "fan-1",
        name: "Quạt phòng khách",
        room: "Phòng khách",
        deviceType: "fan",
        isOnline: false,
        state: { power: "off" },
        lastSeenAt: null,
        readings: [],
      },
      {
        id: "door-1",
        name: "Cửa phòng khách",
        room: "Phòng khách",
        deviceType: "door_servo",
        isOnline: true,
        state: { position: "open", angle: 90 },
        lastSeenAt: new Date().toISOString(),
        readings: [],
      },
    ];
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Công tắc đèn");
    expect(html).toContain("Công tắc quạt");
    expect(html).toContain("Cửa mở (90°)");
    // Offline fan should have disabled accessibility hint
    expect(html).toContain("Thiết bị ngoại tuyến, không thể điều khiển");
  });
});
