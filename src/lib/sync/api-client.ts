/** Client REST vers le serveur central (JWT + rafraîchissement du jeton). */
import { loadSyncConfig } from "./config";

const ACCESS_KEY = "logix-access-token";
const REFRESH_KEY = "logix-refresh-token";

export const tokens = {
  access: () => (typeof localStorage === "undefined" ? null : localStorage.getItem(ACCESS_KEY)),
  refresh: () => (typeof localStorage === "undefined" ? null : localStorage.getItem(REFRESH_KEY)),
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

async function rawRequest(path: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const { serverUrl } = loadSyncConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${serverUrl}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh();
  if (!refresh) return false;
  try {
    const res = await rawRequest("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken) return false;
    tokens.set(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const access = tokens.access();
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const res = await rawRequest(path, { ...init, headers });

  if (res.status === 401 && retry && (await refreshAccessToken())) {
    return api<T>(path, init, false);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, `Erreur serveur [${res.status}] : ${text}`, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Vérifie la disponibilité du serveur central (avec message d'erreur détaillé). */
export async function pingServer(): Promise<{
  online: boolean;
  version?: string;
  database?: string;
  error?: string;
}> {
  const { serverUrl } = loadSyncConfig();
  try {
    const res = await rawRequest("/api/health", { method: "GET" }, 4000);
    if (!res.ok) {
      return { online: false, error: `Le serveur a répondu ${res.status} sur ${serverUrl}/api/health` };
    }
    const data = (await res.json()) as { version?: string; database?: string };
    return { online: true, ...data };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    if (name === "AbortError") {
      return {
        online: false,
        error: `Délai dépassé (4 s) vers ${serverUrl}. Le pare-feu Windows bloque probablement le port, ou l'adresse IP est incorrecte.`,
      };
    }
    return {
      online: false,
      error: `Connexion impossible à ${serverUrl} — ${msg}. Vérifiez que le serveur tourne (npm run dev dans /server), que l'IP est la bonne, et que le port 3000 est ouvert dans le pare-feu.`,
    };
  }
}
