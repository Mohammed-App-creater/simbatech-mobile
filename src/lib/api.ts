/*
 * Fetch wrapper for the Simbatech API. Throws ApiError with the server's customer-facing message.
 *
 * The API keeps the visitor's session (login + guest cart) in a cookie. On a phone the native
 * networking layer stores and sends that cookie for us, exactly like a browser does.
 *
 * Django checks a CSRF token on signed-in POST/PATCH/DELETE requests: the token is the value of
 * the `csrftoken` cookie, echoed back in the X-CSRFToken header. Native code can't read cookies,
 * so the token is taken from the API's `Set-Cookie` header (or a `csrfToken` field in the body of
 * GET /api/auth/csrf, if the API sends one) and kept in memory. Signing in rotates the token; the
 * new value is picked up from the response, and a 403 triggers one refresh-and-retry.
 */
import { Platform } from "react-native";

// The website proxies /api/* to the Django API, so the app talks to the same origin the site does.
const DEFAULT_API_URL = "https://simbatech-e-commerce.vercel.app";

/**
 * Base URL of the site/API (no trailing slash). Set EXPO_PUBLIC_API_URL to point the app at another
 * server, e.g. http://10.0.2.2:8000 for a local API from the Android emulator.
 * The browser preview always uses its own origin (scripts/web-preview.mjs proxies /api for it).
 */
export const API_URL: string = (Platform.OS === "web" ? "" : process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");

/** The public website, for links that only make sense in a browser. */
export const SITE_URL: string = (process.env.EXPO_PUBLIC_SITE_URL || DEFAULT_API_URL).replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status: number, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const isWeb = Platform.OS === "web";
let csrfToken: string | null = null;
let csrfRequest: Promise<void> | null = null;

function readWebCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Picks up a (new) csrftoken from a response's Set-Cookie header. */
function rememberCsrf(res: Response) {
  if (isWeb) return;
  const header = res.headers.get("set-cookie");
  const match = header && header.match(/csrftoken=([^;,\s]+)/);
  if (match) csrfToken = match[1];
}

async function ensureCsrf(force = false) {
  if (isWeb) {
    if (readWebCookie("csrftoken") && !force) return;
  } else if (csrfToken && !force) return;
  csrfRequest =
    csrfRequest ||
    fetch(API_URL + "/api/auth/csrf", { credentials: "include", headers: { accept: "application/json" } })
      .then(async (res) => {
        rememberCsrf(res);
        const body = await res.json().catch(() => null);
        if (body && typeof body.csrfToken === "string") csrfToken = body.csrfToken;
      })
      .finally(() => (csrfRequest = null));
  await csrfRequest;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const unsafe = method !== "GET" && method !== "HEAD";
  if (unsafe) await ensureCsrf();
  const token = unsafe ? (isWeb ? readWebCookie("csrftoken") : csrfToken) : null;
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { "x-csrftoken": token } : {}),
      // Django wants a Referer from a trusted origin on secure requests that carry no Origin header.
      ...(unsafe && !isWeb ? { referer: (API_URL || SITE_URL) + "/" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  rememberCsrf(res);
  return res;
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await send(method, path, body);
    if (res.status === 403 && method !== "GET") {
      // most likely a stale CSRF token (it rotates on sign-in): fetch a fresh one and retry once
      await ensureCsrf(true);
      res = await send(method, path, body);
    }
  } catch {
    throw new ApiError("Can't reach Simbatech. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((data && data.error) || "Something went wrong. Please try again.", res.status, data && data.field);
  return data as T;
}

/** GET that answers null for 401/404 (signed out / not found), like the site's page loaders. */
export async function apiGetOrNull<T = any>(path: string): Promise<T | null> {
  try {
    return await api<T>("GET", path);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return null;
    throw e;
  }
}
