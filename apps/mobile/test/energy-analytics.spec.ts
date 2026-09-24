import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const sessionState = vi.hoisted(() => ({
  session: {
    identity: {
      user: { name: "Test User", email: "t@t.com" },
      households: [{ id: "h1", name: "Test Home", role: "owner" }],
    },
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("../core/session-provider", () => ({ useSession: () => sessionState }));
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
  TextInput: "input",
  Modal: "div",
  Platform: { OS: "ios" },
  StyleSheet: { create: (value: unknown) => value },
}));

import {
  fetchEnergyBreakdown,
  fetchEnergyChart,
  fetchEnergySummary,
  formatVnd,
  updateDeviceWattage,
} from "../features/energy/energy-data";
import { EnergyAnalyticsModal } from "../features/energy/energy-analytics-modal";

describe("Energy Analytics Mobile Feature", () => {
  it("formatVnd formats Vietnamese currency correctly", () => {
    const formatted = formatVnd(150000);
    expect(formatted).toContain("150.000");
    expect(formatted).toContain("₫");
  });

  it("fetchEnergySummary requests summary endpoint", async () => {
    const fakeSummary = {
      today: { kwh: 1.25, costVnd: 3100, diffPercent: 5, runningHours: 4.5 },
      thisMonth: {
        kwh: 45.2,
        costVnd: 98000,
        projectedCostVnd: 120000,
        currentTier: 1,
        tierPrice: 1806,
        nextTierKwh: 4.8,
      },
      activePowerWatts: 75,
      activeDeviceCount: 2,
      totalDeviceCount: 3,
    };
    const mockGet = vi.fn().mockResolvedValue(fakeSummary);
    const session = { get: mockGet } as any;

    const res = await fetchEnergySummary(session, "h-123");
    expect(mockGet).toHaveBeenCalledWith("/households/h-123/energy/summary");
    expect(res.today.kwh).toBe(1.25);
    expect(res.activePowerWatts).toBe(75);
  });

  it("fetchEnergyChart requests chart data with range", async () => {
    const mockGet = vi.fn().mockResolvedValue({
      range: "today",
      points: [{ label: "12:00", kwh: 0.15, costVnd: 375, timestamp: "..." }],
      totalKwh: 0.15,
      totalCostVnd: 375,
    });
    const session = { get: mockGet } as any;

    const res = await fetchEnergyChart(session, "h-123", "today");
    expect(mockGet).toHaveBeenCalledWith("/households/h-123/energy/chart?range=today");
    expect(res.points).toHaveLength(1);
  });

  it("updateDeviceWattage sends PATCH request to update device wattage", async () => {
    const mockPatch = vi.fn().mockResolvedValue({ success: true, deviceId: "d1", wattage: 60 });
    const session = { patch: mockPatch } as any;

    const res = await updateDeviceWattage(session, "h-123", "d1", 60);
    expect(mockPatch).toHaveBeenCalledWith(
      "/households/h-123/energy/devices/d1/power",
      { wattage: 60 }
    );
    expect(res.wattage).toBe(60);
  });

  it("renders EnergyAnalyticsModal structure when opened", () => {
    const html = renderToStaticMarkup(
      createElement(EnergyAnalyticsModal, {
        visible: true,
        onClose: () => {},
        session: sessionState.session as any,
        householdId: "h1",
      })
    );

    expect(html).toContain("Thống Kê Điện &amp; Tiền Điện");
    expect(html).toContain("Biểu giá điện 6 bậc EVN");
    expect(html).toContain("Hôm nay (24h)");
    expect(html).toContain("7 ngày qua");
    expect(html).toContain("Tháng này");
  });
});
