import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const apiUrl = (
  process.env.EXPO_PUBLIC_API_URL || "https://episyhub.space"
).replace(/\/$/, "");
const parsed = new URL(apiUrl);
if (
  parsed.username ||
  parsed.password ||
  parsed.search ||
  parsed.hash ||
  parsed.pathname !== "/" ||
  (parsed.protocol !== "https:" && !(__DEV__ && parsed.protocol === "http:"))
) {
  throw new Error(
    "EXPO_PUBLIC_API_URL должен содержать HTTPS-адрес сервера без пути и пароля",
  );
}
export type User = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
};
export type Session = { token: string; expiresAt: string; user: User };
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  if (!path.startsWith("/api/")) throw new Error("Некорректный путь API");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(apiUrl + path, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ApiError(
        response.status === 404 && path === "/api/mobile/session"
          ? "На этом сервере ещё не установлен API мобильного входа."
          : body?.error || "Сервис временно недоступен. Попробуйте позже.",
        response.status,
      );
    if (body === null)
      throw new ApiError("Сервер вернул неожиданный ответ", 502);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Не удалось связаться с сервером. Проверьте интернет и повторите попытку.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
const key = "episyhub.mobile.session.v1";
// Browser preview deliberately keeps credentials only in memory.
let previewSession: Session | null = null;
export const storage = {
  async read(): Promise<Session | null> {
    if (Platform.OS === "web") return previewSession;
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      if (
        typeof value.token === "string" &&
        /^ehm_[A-Za-z0-9_-]{43}$/.test(value.token) &&
        typeof value.expiresAt === "string" &&
        typeof value.user?.id === "string"
      )
        return value;
    } catch {
      /* Invalid local state must not block login. */
    }
    await SecureStore.deleteItemAsync(key);
    return null;
  },
  async write(value: Session | null) {
    if (Platform.OS === "web") {
      previewSession = value;
      return;
    }
    if (value)
      await SecureStore.setItemAsync(key, JSON.stringify(value), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    else await SecureStore.deleteItemAsync(key);
  },
};
export function imageUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value, apiUrl);
    return ["http:", "https:"].includes(url.protocol)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
