import { loadPoleMetaMap, pruneStoredPoleState } from "./poleStorage";
import { normalizeStreetlightFromApi } from "../utils/poleHelpers";
import { fetchIdTokenSilently, emitAuthRequired, redirectToSignIn } from "./auth";
import { LIGHTWISE_ENV } from "../config/env";
import {
  normalizeOperatorProfile,
  normalizeStreetlightListResponse,
  normalizeTelemetryResponse,
} from "../utils/normalizers";
import {
  MOCK_PROFILE,
  mockListStreetlights,
  mockGetStreetlight,
  mockGetTelemetry,
  mockUpdateMetadata,
} from "./api.mock";

const ALLOWED_INTERVALS = new Set([
  "1m", "5m", "10m", "15m", "30m",
  "1h", "6h", "12h", "1d", "7d", "30d",
]);

/**
 * Authenticated fetch against the LightWise REST API.
 * - Injects idToken into Authorization header (no Bearer prefix — API GW Cognito authorizer)
 * - Handles 401 by emitting auth-required and redirecting to sign-in
 * - Accepts an optional pre-fetched token (e.g. from AuthCallback)
 */
async function apiFetch(path, { method = "GET", body, headers, query } = {}, { token } = {}) {
  const { API_BASE } = LIGHTWISE_ENV;
  if (!API_BASE) throw new Error("Missing REACT_APP_API_BASE in .env");

  const url      = buildUrl(path, query);
  const idToken  = String(token || "").trim() || (await fetchIdTokenSilently());

  if (!idToken) {
    emitAuthRequired("missing_token");
    await redirectToSignIn();
    throw apiError("Unauthenticated", 401);
  }

  const hasBody = body !== undefined && body !== null;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(headers || {}),
        Authorization: idToken,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    const err = new Error(`Failed to fetch (${method} ${url}). Check API URL, backend, or CORS.`);
    err.cause = cause;
    throw err;
  }

  if (res.status === 401) {
    emitAuthRequired("http_401");
    await redirectToSignIn();
    throw apiError("Unauthorized", 401);
  }

  if (res.status === 403) throw apiError("Forbidden: insufficient permissions", 403);
  if (res.status === 404) throw apiError("Resource not found", 404);

  const data = await parseJsonSafely(res);

  if (!res.ok) {
    const msg = data?.error || data?.message || `API error ${res.status}`;
    throw apiError(msg, res.status, data);
  }

  return data;
}

function apiError(message, status, payload) {
  return Object.assign(new Error(message), { status, payload });
}

function buildUrl(path, extraQuery = {}) {
  const { API_BASE } = LIGHTWISE_ENV;
  const base      = API_BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url       = new URL(`${base}${cleanPath}`);

  Object.entries(extraQuery).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });

  return url.toString();
}

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function mergeLocalMeta(streetlights) {
  const list    = Array.isArray(streetlights) ? streetlights : [];
  const metaMap = loadPoleMetaMap() || {};

  return list.map((raw, index) => {
    const row  = normalizeStreetlightFromApi(raw, index);
    const id   = row?.streetlight_id;
    const meta = id ? metaMap[id] : null;
    if (!meta) return row;

    return {
      ...row,
      ...(typeof meta?.name === "string" && meta.name.trim() ? { name: meta.name.trim() } : {}),
      ...(typeof meta?.lat  === "number" && Number.isFinite(meta.lat)  ? { lat: meta.lat }  : {}),
      ...(typeof meta?.lng  === "number" && Number.isFinite(meta.lng)  ? { lng: meta.lng }  : {}),
    };
  });
}

export async function getOperatorProfile(token) {
  if (LIGHTWISE_ENV.USE_MOCK) return normalizeOperatorProfile(MOCK_PROFILE);
  const data = await apiFetch("/auth/me", { method: "GET" }, { token });
  return normalizeOperatorProfile(data);
}


export async function listStreetlights() {
  const { USE_MOCK, TENANT_ID } = LIGHTWISE_ENV;
  if (USE_MOCK) {
    const rows = mockListStreetlights(TENANT_ID);
    pruneStoredPoleState(rows.map((row) => row?.streetlight_id));
    return mergeLocalMeta(rows);
  }
  const data = await apiFetch("/streetlights", { method: "GET" });
  const rows = normalizeStreetlightListResponse(data);
  pruneStoredPoleState(rows.map((row) => row?.streetlight_id));
  return mergeLocalMeta(rows);
}

export async function getStreetlight(id) {
  if (!id) throw new Error("streetlight id is required");
  const { USE_MOCK, TENANT_ID } = LIGHTWISE_ENV;
  if (USE_MOCK) return mergeLocalMeta([mockGetStreetlight(id, TENANT_ID)])[0];
  const data = await apiFetch(`/streetlights/${encodeURIComponent(id)}`, { method: "GET" });
  return mergeLocalMeta([data])[0];
}

export async function getStreetlightTelemetry(id, { from, to, interval = "5m" } = {}) {
  if (!id)          throw new Error("streetlight id is required");
  if (!from || !to) throw new Error("from and to are required");
  if (!ALLOWED_INTERVALS.has(interval)) {
    throw new Error(`interval must be one of: ${Array.from(ALLOWED_INTERVALS).join(", ")}`);
  }

  if (LIGHTWISE_ENV.USE_MOCK) return mockGetTelemetry(id, from, to, interval);

  const data = await apiFetch(
    `/streetlights/${encodeURIComponent(id)}/telemetry`,
    {
      method: "GET",
      query: {
        from:     new Date(from).toISOString(),
        to:       new Date(to).toISOString(),
        interval,
      },
    }
  );

  return { streetlight_id: id, data: normalizeTelemetryResponse(data) };
}

export async function updateStreetlightMetadata(id, body) {
  if (!id)                             throw new Error("streetlight id is required");
  if (!body || typeof body !== "object") throw new Error("body is required");
  if (LIGHTWISE_ENV.USE_MOCK)          return mockUpdateMetadata(id, body);

  return apiFetch(`/streetlights/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body,
  });
}
