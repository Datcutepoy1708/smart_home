import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  home: { name: "Test Home" },
  items: [] as unknown[],
  loading: false,
  error: "",
  refresh: () => {},
  more: null,
}));
vi.mock("../features/devices/use-devices", () => ({ useDevices: () => state }));
vi.mock("react-native", () => ({
  View: "section",
  Text: "span",
  Pressable: "button",
  ScrollView: "main",
  ActivityIndicator: "progress",
  RefreshControl: "aside",
  StyleSheet: { create: (value: unknown) => value },
}));
import DevicesScreen from "../features/devices/devices-screen";
describe("device screen states", () => {
  it("shows loading without a misleading empty state", () => {
    state.loading = true;
    state.items = [];
    state.error = "";
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Loading devices");
    expect(html).not.toContain("No devices");
  });
  it("shows an empty household", () => {
    state.loading = false;
    state.items = [];
    state.error = "";
    expect(renderToStaticMarkup(createElement(DevicesScreen))).toContain(
      "No devices in this home yet",
    );
  });
  it("offers retry on a network error", () => {
    state.loading = false;
    state.items = [];
    state.error = "Unable to connect";
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Unable to connect");
    expect(html).toContain("Try again");
  });
  it("shows offline state and latest values", () => {
    state.loading = false;
    state.error = "";
    state.items = [
      {
        id: "one",
        name: "Sensor",
        room: null,
        isOnline: false,
        lastSeenAt: null,
        readings: [{ metric: "humidity", value: 67, unit: "%" }],
      },
    ];
    const html = renderToStaticMarkup(createElement(DevicesScreen));
    expect(html).toContain("Offline");
    expect(html).toContain("67 %");
  });
});
