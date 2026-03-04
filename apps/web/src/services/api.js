// apps/web/src/services/api.js

import { loadPoleMetaMap } from "./poleStorage";

function env() {
  return {
    USE_MOCK: String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true",
    API_BASE: (process.env.REACT_APP_API_BASE || "").trim(),
    API_KEY: (process.env.REACT_APP_API_KEY || "").trim(), // optional
    TENANT_ID: (process.env.REACT_APP_TENANT_ID || "tenant-001").trim(),
  };
}

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildUrl(path, API_BASE, TENANT_ID, extraQuery = {}) {
  const base = (API_BASE || "").replace(/\/$/, "");
  if (!base) return null;

  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);
  if (TENANT_ID) url.searchParams.set("tenant_id", TENANT_ID);

  Object.entries(extraQuery).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });

  return url.toString();
}

async function request(path, { method = "GET", body, headers, query } = {}) {
  const { API_BASE, API_KEY, TENANT_ID } = env();

  const url = buildUrl(path, API_BASE, TENANT_ID, query || {});
  if (!url) throw new Error("Missing REACT_APP_API_BASE in .env.local");

  const finalHeaders = {
    ...(headers || {}),
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  };

  const hasBody = body !== undefined && body !== null;
  if (hasBody) finalHeaders["Content-Type"] = "application/json";

  console.log("🌐 HTTP", method, url);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error(`Failed to fetch (${method} ${url}). Check CORS / URL / network.`);
    err.cause = e;
    throw err;
  }

  const data = await parseJsonSafely(res);

  if (!res.ok) {
    const msg = data?.error || data?.message || `API error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

// Merge helper: backend list + local meta overrides (so map shows everywhere)
function mergeLocalMeta(streetlights) {
  const list = Array.isArray(streetlights) ? streetlights : [];
  const metaMap = loadPoleMetaMap();

  // metaMap shape: { [streetlight_id]: { name?, lat?, lng? } }
  return list.map((s) => {
    const id = s?.streetlight_id;
    const m = (id && metaMap && metaMap[id]) ? metaMap[id] : null;
    if (!m) return s;

    // If backend has null coords but local has coords, use local.
    // If local has empty/undefined, keep backend.
    const merged = {
      ...s,
      ...(typeof m?.name === "string" && m.name.trim() ? { name: m.name.trim() } : {}),
      ...(typeof m?.lat === "number" && Number.isFinite(m.lat) ? { lat: m.lat } : {}),
      ...(typeof m?.lng === "number" && Number.isFinite(m.lng) ? { lng: m.lng } : {}),
    };

    return merged;
  });
}

// ---------------------------------------------------------------------------
// Max Contract Endpoints
// ---------------------------------------------------------------------------

export async function listStreetlights() {
  const { USE_MOCK, TENANT_ID } = env();

  if (USE_MOCK) {
    const mock = [
      {
        streetlight_id: "LW-00042",
        tenant_id: TENANT_ID,
        health: "DEGRADED",
        lat: 37.7749,
        lng: -122.4194,
        name: "Main Street 5th Ave",
        last_seen: new Date().toISOString(),
        motion_detected: true,
        ambient_primary_ok: true,
        ambient_secondary_ok: false,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      },
    ];
    return mergeLocalMeta(mock);
  }

  // GET /streetlights?tenant_id=...
  const rows = await request("/streetlights", { method: "GET" });
  return mergeLocalMeta(rows);
}

export async function getStreetlight(id) {
  const { USE_MOCK, TENANT_ID } = env();
  if (!id) throw new Error("streetlight id is required");

  if (USE_MOCK) {
    const mock = {
      streetlight_id: id,
      tenant_id: TENANT_ID,
      health: "OK",
      lat: 37.7749,
      lng: -122.4194,
      name: `Streetlight ${id}`,
      last_seen: new Date().toISOString(),
      motion_detected: false,
      ambient_primary_ok: true,
      ambient_secondary_ok: true,
      th_ok: true,
      motion_primary_ok: true,
      motion_secondary_ok: true,
    };
    return mergeLocalMeta([mock])[0];
  }

  // GET /streetlights/{id}?tenant_id=...
  const row = await request(`/streetlights/${encodeURIComponent(id)}`, { method: "GET" });
  return mergeLocalMeta([row])[0];
}

export async function getStreetlightTelemetry(id, { from, to, interval = "5m" } = {}) {
  const { USE_MOCK } = env();
  if (!id) throw new Error("streetlight id is required");
  if (!from || !to) throw new Error("from and to are required");

  if (USE_MOCK) {
    return { streetlight_id: id, data: [] };
  }

  // GET /streetlights/{id}/telemetry?tenant_id=...&from=...&to=...&interval=...
  return request(`/streetlights/${encodeURIComponent(id)}/telemetry`, {
    method: "GET",
    query: { from, to, interval },
  });
}

// Max request: validation is done in Admin before calling this.
// Still keep API thin and focused.
export async function updateStreetlightMetadata(id, body) {
  const { USE_MOCK } = env();
  if (!id) throw new Error("streetlight id is required");
  if (!body || typeof body !== "object") throw new Error("body is required");

  if (USE_MOCK) {
    return { message: "updated (mock)" };
  }

  // PUT /streetlights/{id}/metadata?tenant_id=...
  return request(`/streetlights/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body,
  });
}