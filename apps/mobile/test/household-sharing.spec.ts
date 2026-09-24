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
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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
  Alert: { alert: vi.fn() },
}));

import {
  createHousehold,
  createInviteCode,
  fetchHouseholdMembers,
  joinHouseholdByCode,
  removeMember,
  updateMemberRole,
} from "../features/households/household-data";
import { MembersManagementModal } from "../features/households/members-management-modal";
import { JoinHouseholdModal } from "../features/households/join-household-modal";
import { CreateHouseholdModal } from "../features/households/create-household-modal";

describe("Household Sharing and Member Management Mobile Feature", () => {
  it("fetchHouseholdMembers requests members endpoint", async () => {
    const mockGet = vi.fn().mockResolvedValue({
      members: [
        {
          id: "m1",
          userId: "u1",
          name: "Owner User",
          email: "o@test.com",
          role: "OWNER",
          joinedAt: "2026-09-01T00:00:00Z",
          expiresAt: null,
          isExpired: false,
          isCurrent: true,
        },
      ],
    });
    const session = { get: mockGet } as any;

    const res = await fetchHouseholdMembers(session, "h-123");
    expect(mockGet).toHaveBeenCalledWith("/households/h-123/members");
    expect(res).toHaveLength(1);
    expect(res[0].role).toBe("OWNER");
  });

  it("createInviteCode requests invite creation with role", async () => {
    const mockPost = vi.fn().mockResolvedValue({
      code: "HM-8899",
      householdId: "h-123",
      householdName: "Test Home",
      role: "GUEST",
      expiresAt: "...",
    });
    const session = { post: mockPost } as any;

    const res = await createInviteCode(session, "h-123", "GUEST", 72);
    expect(mockPost).toHaveBeenCalledWith("/households/h-123/invites", {
      role: "GUEST",
      validHours: 72,
    });
    expect(res.code).toBe("HM-8899");
  });

  it("joinHouseholdByCode sends join request with normalized code", async () => {
    const mockPost = vi.fn().mockResolvedValue({
      success: true,
      householdId: "h-new",
      householdName: "Ba Vi Villa",
      role: "MEMBER",
    });
    const session = { post: mockPost } as any;

    const res = await joinHouseholdByCode(session, "hm-8899");
    expect(mockPost).toHaveBeenCalledWith("/households/join", {
      code: "HM-8899",
    });
    expect(res.householdName).toBe("Ba Vi Villa");
  });

  it("updateMemberRole sends patch request with new role", async () => {
    const mockPatch = vi.fn().mockResolvedValue({ id: "m1", role: "GUEST", expiresAt: null });
    const session = { patch: mockPatch } as any;

    await updateMemberRole(session, "h-1", "m1", "GUEST");
    expect(mockPatch).toHaveBeenCalledWith("/households/h-1/members/m1", {
      role: "GUEST",
      expiresAt: undefined,
    });
  });

  it("removeMember sends delete request", async () => {
    const mockDelete = vi.fn().mockResolvedValue({ success: true, memberId: "m1" });
    const session = { delete: mockDelete } as any;

    await removeMember(session, "h-1", "m1");
    expect(mockDelete).toHaveBeenCalledWith("/households/h-1/members/m1");
  });

  it("createHousehold sends create household request", async () => {
    const mockPost = vi.fn().mockResolvedValue({ id: "h-new", name: "Penthouse", role: "OWNER" });
    const session = { post: mockPost } as any;

    const res = await createHousehold(session, "Penthouse");
    expect(mockPost).toHaveBeenCalledWith("/households", { name: "Penthouse" });
    expect(res.name).toBe("Penthouse");
  });

  it("renders MembersManagementModal with sections and actions", () => {
    const html = renderToStaticMarkup(
      createElement(MembersManagementModal, {
        visible: true,
        onClose: () => {},
        session: sessionState.session as any,
        householdId: "h1",
        householdName: "Nhà Thông Minh",
        isOwner: true,
      })
    );

    expect(html).toContain("Thành Viên &amp; Chia Sẻ Nhà");
    expect(html).toContain("MỜI THÀNH VIÊN VÀO NHÀ");
    expect(html).toContain("DANH SÁCH THÀNH VIÊN");
    expect(html).toContain("Tạo Mã Mời Nhanh");
  });

  it("renders JoinHouseholdModal with input and join action", () => {
    const html = renderToStaticMarkup(
      createElement(JoinHouseholdModal, {
        visible: true,
        onClose: () => {},
        session: sessionState.session as any,
      })
    );

    expect(html).toContain("Gia Nhập Ngôi Nhà");
    expect(html).toContain("Tham Gia Ngay");
  });

  it("renders CreateHouseholdModal with name input and create action", () => {
    const html = renderToStaticMarkup(
      createElement(CreateHouseholdModal, {
        visible: true,
        onClose: () => {},
        session: sessionState.session as any,
      })
    );

    expect(html).toContain("Tạo Ngôi Nhà Mới");
    expect(html).toContain("Tạo Ngay");
  });
});
