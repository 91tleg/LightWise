import { fetchAuthSession, signInWithRedirect, signOut } from "aws-amplify/auth";
import { COGNITO_ENV } from "../config/env";

const AUTH_REQUIRED_EVENT = "lightwise:auth-required";
const SESSION_LOOKUP_TIMEOUT_MS = 3000;

function emitAuthRequired(reason = "unauthenticated") {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_REQUIRED_EVENT, {
      detail: { reason },
    })
  );
}

function buildUnauthorizedError(message = "Unauthenticated") {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(buildUnauthorizedError(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getLogoutRedirectUrl() {
  if (COGNITO_ENV.LOGOUT_URI) {
    return COGNITO_ENV.LOGOUT_URI;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/`;
}

export async function fetchRequiredAccessToken(options = {}) {
  const { timeoutMs = SESSION_LOOKUP_TIMEOUT_MS, ...sessionOptions } = options || {};
  const session = await withTimeout(
    fetchAuthSession(sessionOptions),
    timeoutMs,
    "Timed out while loading Cognito session"
  );
  const token = session?.tokens?.accessToken?.toString?.() || "";

  if (!token) {
    throw buildUnauthorizedError("Missing Cognito access token");
  }

  return token;
}

export async function waitForAccessToken({
  attempts = 8,
  delayMs = 200,
  timeoutMs = SESSION_LOOKUP_TIMEOUT_MS,
  ...options
} = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchRequiredAccessToken({ ...options, timeoutMs });
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        throw error;
      }
      await delay(delayMs);
    }
  }

  throw lastError || buildUnauthorizedError("Missing Cognito access token");
}

export async function fetchAccessToken(options = {}) {
  try {
    return await fetchRequiredAccessToken(options);
  } catch {
    return "";
  }
}

export function subscribeToAuthRequired(listener) {
  if (typeof window === "undefined" || typeof listener !== "function") {
    return () => {};
  }

  const handleChange = (event) => {
    listener(String(event?.detail?.reason || "unauthenticated"));
  };

  window.addEventListener(AUTH_REQUIRED_EVENT, handleChange);
  return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleChange);
}

export async function redirectToHostedLogin() {
  return signInWithRedirect();
}

export async function signOutFromHostedUi() {
  return signOut({
    global: false,
    oauth: {
      redirectUrl: getLogoutRedirectUrl(),
    },
  });
}

export async function authFetch(url, options = {}, { accessToken } = {}) {
  const token = String(accessToken || "").trim() || (await fetchAccessToken());

  if (!token) {
    emitAuthRequired("missing_token");
    await redirectToHostedLogin();
    throw buildUnauthorizedError();
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    emitAuthRequired("http_401");
    await redirectToHostedLogin();
  }

  return response;
}
