// src/services/api.js

function env() {
  return {
    USE_MOCK: String(process.env.REACT_APP_USE_MOCK || "true") !== "false",
    API_BASE: process.env.REACT_APP_API_BASE || "",
    API_KEY: process.env.REACT_APP_API_KEY || "",
    TENANT_ID: process.env.REACT_APP_TENANT_ID || "tenant-001",
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

function withTenant(path, API_BASE, TENANT_ID) {
  const base = (API_BASE || "").replace(/\/$/, "");
  const full = base ? `${base}${path}` : path;

  // If base missing, keep path unchanged
  if (!base) return full;

  const u = new URL(full);
  if (TENANT_ID) u.searchParams.set("tenant_id", TENANT_ID);
  return u.toString();
}

async function request(path, options = {}) {
  const { API_BASE, API_KEY, TENANT_ID } = env();

  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;

  const headers = {
    ...(options.headers || {}),
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  };

  // Don’t trigger preflight on GET if you can avoid it
  if (hasBody) headers["Content-Type"] = "application/json";

  const url = withTenant(path, API_BASE, TENANT_ID);

  let res;
  try {
    res = await fetch(url, { ...options, method, headers });
  } catch (e) {
    const err = new Error(
      `Failed to fetch (${method} ${url}). Likely CORS/network/DNS.`
    );
    err.cause = e;
    throw err;
  }

  const data = await parseJsonSafely(res);

  if (!res.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `API error ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

// ============================================================================
// Streetlights API
// ============================================================================

export async function listStreetlights() {
  const { USE_MOCK, API_BASE, TENANT_ID } = env();

  if (USE_MOCK || !API_BASE) {
    return [
      {
        streetlight_id: "LW-00042",
        tenant_id: TENANT_ID,
        health: "OK",
        lat: 47.6101,
        lng: -122.2015,
        name: "BC Demo Pole",
        last_seen: new Date().toISOString(),
        motion_detected: false,
        light_level_pct: 55,
        ambient_primary_ok: true,
        ambient_secondary_ok: true,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      },
      {
        streetlight_id: "LW-00043",
        tenant_id: TENANT_ID,
        health: "DEGRADED",
        lat: 47.6099,
        lng: -122.2022,
        name: "Parking Lot Pole",
        last_seen: new Date().toISOString(),
        motion_detected: true,
        light_level_pct: 90,
        ambient_primary_ok: true,
        ambient_secondary_ok: false,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: false,
      },
    ];
  }

  return request(`/streetlights`, { method: "GET" });
}

export async function getStreetlight(id) {
  const { USE_MOCK, API_BASE, TENANT_ID } = env();

  if (!id) throw new Error("streetlight id is required");

  if (USE_MOCK || !API_BASE) {
    return {
      streetlight_id: id,
      tenant_id: TENANT_ID,
      health: "OK",
      lat: 47.6101,
      lng: -122.2015,
      name: `Streetlight ${id}`,
      last_seen: new Date().toISOString(),
      motion_detected: false,
      light_level_pct: 50,
      ambient_primary_ok: true,
      ambient_secondary_ok: true,
      th_ok: true,
      motion_primary_ok: true,
      motion_secondary_ok: true,
    };
  }

  return request(`/streetlights/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function getStreetlightTelemetry(id, { from, to, interval = "5m" }) {
  const { USE_MOCK, API_BASE } = env();

  if (!id) throw new Error("streetlight id is required");
  if (!from || !to) throw new Error("from and to are required");

  if (USE_MOCK || !API_BASE) {
    return { streetlight_id: id, data: [] };
  }

  const params = new URLSearchParams();
  params.set("from", from);
  params.set("to", to);
  if (interval) params.set("interval", interval);

  return request(
    `/streetlights/${encodeURIComponent(id)}/telemetry?${params.toString()}`,
    { method: "GET" }
  );
}

export async function updateStreetlightMetadata(id, body) {
  const { USE_MOCK, API_BASE } = env();

  if (!id) throw new Error("streetlight id is required");
  if (!body || typeof body !== "object") throw new Error("body is required");

  if (USE_MOCK || !API_BASE) {
    return { message: "updated (mock)" };
  }

  return request(`/streetlights/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}