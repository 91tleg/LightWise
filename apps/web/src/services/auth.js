import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { COGNITO_ENV } from "../config/env";

const SESSION_TIMEOUT_MS = 3000;
const AUTH_REQUIRED_EVENT = "lightwise:auth-required";

function buildUnauthorizedError(message = "Unauthenticated") {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function withTimeout(promise, ms, message) {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(buildUnauthorizedError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLogoutUrl() {
  return COGNITO_ENV.LOGOUT_URI || (typeof window !== "undefined" ? `${window.location.origin}/` : "");
}

export async function fetchIdToken(options = {}) {
  const { timeoutMs = SESSION_TIMEOUT_MS, ...sessionOptions } = options;
  const session = await withTimeout(
    fetchAuthSession(sessionOptions),
    timeoutMs,
    "Sign-in is taking longer than expected. Please try again."
  );
  const token = session?.tokens?.idToken?.toString() ?? "";
  if (!token) throw buildUnauthorizedError("Please sign in again.");
  return token;
}

/** Retries on failure — use in AuthCallback after redirect */
export async function waitForIdToken({ attempts = 8, delayMs = 200, ...options } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchIdToken(options);
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await delay(delayMs);
    }
  }
  throw lastError;
}

/** Silent fetch — returns empty string instead of throwing */
export async function fetchIdTokenSilently(options = {}) {
  try {
    return await fetchIdToken(options);
  } catch {
    return "";
  }
}

export function emitAuthRequired(reason = "unauthenticated") {
  window?.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { reason } }));
}

export function subscribeToAuthRequired(listener) {
  if (typeof window === "undefined" || typeof listener !== "function") return () => {};
  const handler = (e) => listener(String(e?.detail?.reason ?? "unauthenticated"));
  window.addEventListener(AUTH_REQUIRED_EVENT, handler);
  return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handler);
}

export const redirectToSignIn = () => signInWithRedirect();

export const redirectToSignOut = () =>
  signOut({ global: false, oauth: { redirectUrl: getLogoutUrl() } });
