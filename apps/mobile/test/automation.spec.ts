import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const sessionState = vi.hoisted(() => ({
  session: {
    identity: {
      user: { name: "Test User", email: "t@t.com" },
      households: [{ id: "h1", name: "Test Home", role: "owner" }],
    },
    get: vi.fn().mockResolvedValue([]),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
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
  TextInput: "input",
  Switch: "input",
  Modal: "div",
  StyleSheet: { create: (value: unknown) => value },
}));

import AutomationScreen from "../app/(tabs)/automation";

describe("automation screen", () => {
  it("renders automation management header and empty state when no rules exist", () => {
    const html = renderToStaticMarkup(createElement(AutomationScreen));
    expect(html).toContain("Tự động hoá");
    expect(html).toContain("Hẹn Giờ");
  });
});
