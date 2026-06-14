import { COGNITO_ENV, LIGHTWISE_ENV } from "../config/env";

const AUTH_REQUIRED_EVENT = "lightwise:auth-required";
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;
const HOSTED_UI_SCOPES = "email openid profile";

let refreshTimer = null;

function normalizeBaseUrl(value = "") {
  return String(value || "").trim().replace(/\/$/, "");
}

function normalizeCognitoDomain(domain = "") {
  const value = normalizeBaseUrl(domain);
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function getRedirectUri() {
  return (
    COGNITO_ENV.REDIRECT_URI ||
    (LIGHTWISE_ENV.API_BASE ? `${normalizeBaseUrl(LIGHTWISE_ENV.API_BASE)}/auth/callback` : "")
  );
}

function getLogoutUri() {
  return COGNITO_ENV.LOGOUT_URI || (typeof window !== "undefined" ? `${window.location.origin}/` : "");
}

function buildHostedUiUrl(path, params) {
  const domain = normalizeCognitoDomain(COGNITO_ENV.DOMAIN);
  if (!domain || !COGNITO_ENV.CLIENT_ID) {
    throw new Error("Cognito Hosted UI is not configured.");
  }

  const url = new URL(`${domain}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function buildApiUrl(path) {
  const base = normalizeBaseUrl(LIGHTWISE_ENV.API_BASE);
  if (!base) throw new Error("LightWise is not ready yet. Please try again later.");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function emitAuthRequired(reason = "unauthenticated") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { reason } }));
}

export function subscribeToAuthRequired(listener) {
  if (typeof window === "undefined" || typeof listener !== "function") return () => {};
  const handler = (e) => listener(String(e?.detail?.reason ?? "unauthenticated"));
  window.addEventListener(AUTH_REQUIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handler);
}

export function redirectToSignIn() {
  window.location.href = buildHostedUiUrl("/login", {
    client_id: COGNITO_ENV.CLIENT_ID,
    response_type: "code",
    scope: HOSTED_UI_SCOPES,
    redirect_uri: getRedirectUri(),
  });
}

export function redirectToSignOut() {
  stopTokenRefresh();
  window.location.href = buildHostedUiUrl("/logout", {
    client_id: COGNITO_ENV.CLIENT_ID,
    logout_uri: getLogoutUri(),
  });
}

export async function refreshTokens({ emitOnFailure = true } = {}) {
  const response = await fetch(buildApiUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });

  if (response.status === 401) {
    if (emitOnFailure) emitAuthRequired("refresh_401");
    throw Object.assign(new Error("Please sign in again."), { status: 401 });
  }

  if (!response.ok) {
    throw Object.assign(new Error("Unable to refresh session."), { status: response.status });
  }

  return true;
}

export function startTokenRefresh() {
  if (typeof window === "undefined" || refreshTimer) return;

  refreshTimer = window.setInterval(() => {
    refreshTokens().catch(() => {});
  }, REFRESH_INTERVAL_MS);
}

export function stopTokenRefresh() {
  if (typeof window === "undefined" || !refreshTimer) return;
  window.clearInterval(refreshTimer);
  refreshTimer = null;
}
