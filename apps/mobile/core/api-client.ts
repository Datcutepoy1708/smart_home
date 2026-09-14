export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const rawBase = process.env.EXPO_PUBLIC_API_URL;
  if (!rawBase) throw new ApiError("API address is not configured.");
  const isAndroid =
    process.env.EXPO_OS === "android" ||
    (typeof navigator !== "undefined" &&
      /android/i.test(navigator.userAgent ?? ""));
  const base =
    isAndroid && rawBase.includes("localhost")
      ? rawBase.replace("localhost", "10.0.2.2")
      : rawBase;
  const controller = new AbortController();
  const timeout = Number(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS ?? 10000);
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000)
    throw new ApiError("Request timeout is not configured correctly.");
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "Check your details and try again.",
        401: "Your session or sign-in details are invalid.",
        403: "You no longer have access to this home.",
        409: "This email is already registered.",
        429: "Too many attempts. Please wait a minute.",
      };
      throw new ApiError(
        messages[response.status] ?? "Server unavailable. Please try again.",
        response.status,
      );
    }
    return response.status === 204 ? null : await response.json();
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Unable to connect. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}
