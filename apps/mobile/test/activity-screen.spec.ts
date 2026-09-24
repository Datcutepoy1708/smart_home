import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const sessionState = vi.hoisted(() => ({
  session: {
    identity: {
      user: { name: "Test User", email: "t@t.com" },
      households: [{ id: "h1", name: "Test Home", role: "owner" }],
    },
    get: vi.fn().mockResolvedValue({
      items: [
        {
          id: "cmd-1",
          type: "COMMAND",
          title: "Bật Đèn phòng khách",
          deviceName: "Đèn phòng khách",
          deviceType: "light",
          source: "APP",
          status: "ACKNOWLEDGED",
          actor: "Test User",
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  },
}));

vi.mock("../core/session-provider", () => ({ useSession: () => sessionState }));
vi.mock("expo-router", () => ({
  useFocusEffect: vi.fn(),
  router: { push: () => {}, back: () => {}, replace: () => {} },
}));
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
  StyleSheet: { create: (value: unknown) => value },
}));

import ActivityScreen from "../features/activity/activity-screen";

describe("activity screen", () => {
  it("renders activity feed with filter pills and timeline items", () => {
    const html = renderToStaticMarkup(createElement(ActivityScreen));
    expect(html).toContain("Hoạt động &amp; Nhật ký");
    expect(html).toContain("Dòng sự kiện ngôi nhà");
    expect(html).toContain("Tất cả");
    expect(html).toContain("Điều khiển");
    expect(html).toContain("Tự động");
    expect(html).toContain("Cảnh báo");
  });
});
