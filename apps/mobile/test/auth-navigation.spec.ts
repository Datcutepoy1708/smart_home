import { describe, expect, it, vi } from "vitest";

describe("auth transition navigation behavior", () => {
  it("only navigates when authentication state changes, not on token refresh", () => {
    const routerReplace = vi.fn();
    let wasAuthenticated: boolean | null = null;

    function handleAuthEffect(loading: boolean, hasIdentity: boolean) {
      if (loading) return;
      const isAuthenticated = hasIdentity;
      if (wasAuthenticated === isAuthenticated) return;

      wasAuthenticated = isAuthenticated;
      if (isAuthenticated) {
        routerReplace("/(tabs)");
      } else {
        routerReplace("/sign-in");
      }
    }

    // 1. App starts loading
    handleAuthEffect(true, false);
    expect(routerReplace).not.toHaveBeenCalled();

    // 2. Initial login / session restored
    handleAuthEffect(false, true);
    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenLastCalledWith("/(tabs)");

    // 3. Token refreshed in background -> new identity object with same authenticated status
    handleAuthEffect(false, true);
    expect(routerReplace).toHaveBeenCalledTimes(1); // Still 1! No unwanted redirect to tabs

    // 4. Another token refresh in background
    handleAuthEffect(false, true);
    expect(routerReplace).toHaveBeenCalledTimes(1);

    // 5. User logs out or token revoked
    handleAuthEffect(false, false);
    expect(routerReplace).toHaveBeenCalledTimes(2);
    expect(routerReplace).toHaveBeenLastCalledWith("/sign-in");
  });
});
