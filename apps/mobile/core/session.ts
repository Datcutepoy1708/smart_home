import { ApiError } from "./api-client";
export interface Identity {
  user: { id: string; name: string; email: string };
  households: { id: string; name: string; role: string }[];
}
export interface AuthResponse extends Identity {
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
  };
}
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
}
type Request = (path: string, options?: RequestInit) => Promise<unknown>;
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function parseAuth(value: unknown): AuthResponse {
  if (
    !isRecord(value) ||
    !isRecord(value.user) ||
    !isRecord(value.tokens) ||
    !["id", "name", "email"].every(
      (key) => typeof (value.user as Record<string, unknown>)[key] === "string",
    ) ||
    !Array.isArray(value.households) ||
    !value.households.every(
      (h) =>
        isRecord(h) &&
        ["id", "name", "role"].every((key) => typeof h[key] === "string"),
    ) ||
    typeof value.tokens.accessToken !== "string" ||
    typeof value.tokens.refreshToken !== "string" ||
    typeof value.tokens.accessTokenExpiresIn !== "number"
  )
    throw new ApiError("Invalid server response.");
  return value as unknown as AuthResponse;
}
export class Session {
  identity: Identity | null = null;
  private accessToken: string | null = null;
  private refreshFlight: Promise<void> | null = null;
  private generation = 0;
  private signingOut = false;
  private storageQueue: Promise<void> = Promise.resolve();
  onChange: () => void = () => {};
  constructor(
    private readonly storage: TokenStorage,
    private readonly request: Request,
  ) {}
  private store(operation: () => Promise<void>) {
    const next = this.storageQueue.then(operation);
    this.storageQueue = next.catch(() => {});
    return next;
  }
  private async accept(value: unknown, generation: number) {
    const auth = parseAuth(value);
    if (generation !== this.generation) return;
    await this.store(() => this.storage.set(auth.tokens.refreshToken));
    if (generation !== this.generation) return;
    this.accessToken = auth.tokens.accessToken;
    this.identity = { user: auth.user, households: auth.households };
    this.onChange();
  }
  async signIn(mode: "login" | "register", details: Record<string, string>) {
    const generation = ++this.generation;
    await this.accept(
      await this.request(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(details),
      }),
      generation,
    );
  }
  async restore() {
    if (await this.storage.get()) await this.refresh();
  }
  private refresh(): Promise<void> {
    if (this.refreshFlight) return this.refreshFlight;
    if (this.signingOut)
      return Promise.reject(new ApiError("Signing out.", 401));
    const generation = this.generation;
    this.refreshFlight = (async () => {
      const token = await this.storage.get();
      if (!token) throw new ApiError("Please sign in again.", 401);
      try {
        await this.accept(
          await this.request("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refreshToken: token }),
          }),
          generation,
        );
      } catch (error: unknown) {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          generation === this.generation
        ) {
          await this.store(() => this.storage.remove());
          this.accessToken = null;
          this.identity = null;
          this.onChange();
        }
        throw error;
      }
    })().finally(() => {
      this.refreshFlight = null;
    });
    return this.refreshFlight;
  }
  async get(path: string) {
    if (this.signingOut) throw new ApiError("Signing out.", 401);
    const token = this.accessToken;
    try {
      return await this.request(path, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (token === this.accessToken) await this.refresh();
      return this.request(path, {
        headers: { Authorization: `Bearer ${this.accessToken ?? ""}` },
      });
    }
  }
  async post(path: string, body?: unknown) {
    if (this.signingOut) throw new ApiError("Signing out.", 401);
    const token = this.accessToken;
    const options: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    try {
      return await this.request(path, options);
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (token === this.accessToken) await this.refresh();
      return this.request(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken ?? ""}`,
          "Content-Type": "application/json",
        },
      });
    }
  }
  async patch(path: string, body?: unknown) {
    if (this.signingOut) throw new ApiError("Signing out.", 401);
    const token = this.accessToken;
    const options: RequestInit = {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    try {
      return await this.request(path, options);
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (token === this.accessToken) await this.refresh();
      return this.request(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken ?? ""}`,
          "Content-Type": "application/json",
        },
      });
    }
  }
  async delete(path: string) {
    if (this.signingOut) throw new ApiError("Signing out.", 401);
    const token = this.accessToken;
    const options: RequestInit = {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
      },
    };
    try {
      return await this.request(path, options);
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (token === this.accessToken) await this.refresh();
      return this.request(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken ?? ""}`,
        },
      });
    }
  }
  async logout() {
    this.signingOut = true;
    try {
      // Wait for rotation before revoking the currently stored token.
      if (this.refreshFlight) await this.refreshFlight;
      const token = await this.storage.get();
      if (token) {
        try {
          await this.request("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken: token }),
          });
        } catch (error: unknown) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
        }
      }
      ++this.generation;
      await this.store(() => this.storage.remove());
      this.accessToken = null;
      this.identity = null;
      this.onChange();
    } finally {
      this.signingOut = false;
    }
  }
}
