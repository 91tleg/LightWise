// LightWise/apps/web/src/services/api.js

const USE_MOCK = String(process.env.REACT_APP_USE_MOCK || "true") !== "false";
const API_BASE = process.env.REACT_APP_API_BASE || "";
const API_KEY = process.env.REACT_APP_API_KEY || "";
const TENANT_ID = process.env.REACT_APP_TENANT_ID || "tenant-001";

async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withTenant(path) {
  const base = API_BASE.replace(/\/$/, "");
  const full = `${base}${path}`;

  if (!base) return path;

  const u = new URL(full);
  if (TENANT_ID) u.searchParams.set("tenant_id", TENANT_ID);
  return u.toString();
}

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body !== undefined && options.body !== null;

  // IMPORTANT:
  // - Do NOT send Content-Type on GET (causes CORS preflight)
  // - Do NOT send custom headers like x-request-id unless Kirat explicitly allows them
  const headers = {
    ...(options.headers || {}),
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  };

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  let res;
  try {
    res = await fetch(withTenant(path), {
      ...options,
      method,
      headers,
    });
  } catch (e) {
    // This is the classic "Failed to fetch" (CORS/network/DNS)
    const err = new Error(
      `Failed to fetch (${method} ${withTenant(path)}). Most likely CORS is blocking the request.`
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
// Max Contract: Streetlights API
// ============================================================================

export async function listStreetlights() {
  if (USE_MOCK || !API_BASE) {
    return [
      {
        streetlight_id: "LW-00042",
        tenant_id: TENANT_ID,
        health: "DEGRADED",
        lat: 37.7749,
        lng: -122.4194,
        name: "Main Street 5th Ave",
        last_seen: new Date().toISOString(),
        motion_detected: false,
        ambient_primary_ok: true,
        ambient_secondary_ok: false,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      },
    ];
  }
  return request(`/streetlights`, { method: "GET" });
}

export async function getStreetlight(id) {
  if (!id) throw new Error("streetlight id is required");

  if (USE_MOCK || !API_BASE) {
    return {
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
  }

  return request(`/streetlights/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function getStreetlightTelemetry(id, { from, to, interval = "5m" }) {
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
  if (!id) throw new Error("streetlight id is required");
  if (!body || typeof body !== "object") throw new Error("body is required");

  if (USE_MOCK || !API_BASE) {
    return { message: "updated" };
  }

  return request(`/streetlights/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}