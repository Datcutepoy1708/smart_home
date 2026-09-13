import { describe, expect, it, vi } from "vitest";
import { Session, parseAuth, type TokenStorage } from "../core/session";
import { ApiError } from "../core/api-client";
import { parseDevices } from "../features/devices/device-data";
const auth = (accessToken = "access", refreshToken = "refresh") => ({
  user: { id: "user", name: "Test", email: "test@example.com" },
  households: [{ id: "home", name: "Home", role: "owner" }],
  tokens: { accessToken, refreshToken, accessTokenExpiresIn: 900 },
});
function storage(initial: string | null = null) {
  let token = initial;
  return {
    get: vi.fn(async () => token),
    set: vi.fn(async (value: string) => {
      token = value;
    }),
    remove: vi.fn(async () => {
      token = null;
    }),
  } satisfies TokenStorage;
}
describe("mobile session", () => {
  it("stores only refresh token and restores identity with rotated token", async () => {
    const store = storage("old");
    const request = vi.fn(async () => auth());
    const session = new Session(store, request);
    await session.restore();
    expect(store.set).toHaveBeenCalledWith("refresh");
    expect(session.identity?.user.name).toBe("Test");
    expect(request).toHaveBeenCalledWith(
      "/auth/refresh",
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: "old" }),
      }),
    );
  });
  it("shares one refresh for simultaneous expired requests and retries once", async () => {
    const store = storage();
    const request = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === "/auth/login") return auth("old", "refresh");
      if (path === "/auth/refresh") {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return auth("new", "rotated");
      }
      if (
        (options?.headers as Record<string, string>).Authorization ===
        "Bearer old"
      )
        throw new ApiError("expired", 401);
      return { items: [] };
    });
    const session = new Session(store, request);
    await session.signIn("login", {});
    await Promise.all([session.get("/devices"), session.get("/devices")]);
    expect(
      request.mock.calls.filter(([path]) => path === "/auth/refresh"),
    ).toHaveLength(1);
    expect(await store.get()).toBe("rotated");
  });
  it("preserves token on offline restore but removes a revoked token", async () => {
    const store = storage("refresh");
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("offline"))
      .mockRejectedValueOnce(new ApiError("revoked", 401));
    const session = new Session(store, request);
    await expect(session.restore()).rejects.toThrow("offline");
    expect(await store.get()).toBe("refresh");
    await expect(session.restore()).rejects.toThrow("revoked");
    expect(await store.get()).toBeNull();
  });
  it("revokes on logout and does not silently claim offline logout succeeded", async () => {
    const store = storage("refresh");
    const request = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("offline"))
      .mockResolvedValueOnce(null);
    const session = new Session(store, request);
    await expect(session.logout()).rejects.toThrow("offline");
    expect(await store.get()).toBe("refresh");
    await session.logout();
    expect(await store.get()).toBeNull();
  });
  it("rejects malformed server responses", () => {
    expect(() => parseAuth({ tokens: {} })).toThrow();
    expect(() => parseDevices({ items: [{}], nextCursor: null })).toThrow();
    expect(parseDevices({ items: [], nextCursor: null }).items).toEqual([]);
  });
});
