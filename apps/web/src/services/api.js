import { loadPoleMetaMap } from "./poleStorage";
import { normalizeStreetlightFromApi } from "../utils/poleHelpers";

function env() {
  return {
    USE_MOCK: String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true",
    API_BASE: (process.env.REACT_APP_API_BASE || "").trim(),
    API_KEY: (process.env.REACT_APP_API_KEY || "").trim(),
    TENANT_ID: (process.env.REACT_APP_TENANT_ID || "tenant-001").trim(),
  };
}

const ALLOWED_INTERVALS = new Set([
  "1m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "6h",
  "12h",
  "1d",
  "7d",
  "30d",
]);

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

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);

  if (TENANT_ID) {
    url.searchParams.set("tenant_id", TENANT_ID);
  }

  Object.entries(extraQuery).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function request(path, { method = "GET", body, headers, query } = {}) {
  const { API_BASE, API_KEY, TENANT_ID } = env();

  const url = buildUrl(path, API_BASE, TENANT_ID, query || {});
  if (!url) {
    throw new Error("Missing REACT_APP_API_BASE in .env");
  }

  const finalHeaders = {
    ...(headers || {}),
    ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
  };

  const hasBody = body !== undefined && body !== null;
  if (hasBody) {
    finalHeaders["Content-Type"] = "application/json";
  }

  console.log("🌐 HTTP", method, url);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    const err = new Error(`Failed to fetch (${method} ${url}). Check API URL, backend, or CORS.`);
    err.cause = cause;
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

function normalizeStreetlight(row, index = 0) {
  return normalizeStreetlightFromApi(row, index);
}

function mergeLocalMeta(streetlights) {
  const list = Array.isArray(streetlights) ? streetlights : [];
  const metaMap = loadPoleMetaMap() || {};

  return list.map((raw, index) => {
    const row = normalizeStreetlight(raw, index);
    const id = row?.streetlight_id;
    const meta = id ? metaMap[id] : null;

    if (!meta) return row;

    return {
      ...row,
      ...(typeof meta?.name === "string" && meta.name.trim()
        ? { name: meta.name.trim() }
        : {}),
      ...(typeof meta?.lat === "number" && Number.isFinite(meta.lat)
        ? { lat: meta.lat }
        : {}),
      ...(typeof meta?.lng === "number" && Number.isFinite(meta.lng)
        ? { lng: meta.lng }
        : {}),
    };
  });
}

function normalizeStreetlightListResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.streetlights)) return data.streetlights;
  return [];
}

function normalizeTelemetryResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.telemetry)) return data.telemetry;
  return [];
}

export async function listStreetlights() {
  const { USE_MOCK, TENANT_ID } = env();

  if (USE_MOCK) {
    const mock = [
      {
        streetlight_id: "LW-00042",
        tenant_id: TENANT_ID,
        health: "OK",
        lat: 47.6101,
        lng: -122.2015,
        name: "main",
        last_seen: new Date().toISOString(),
        motion_detected: true,
        ambient_primary_ok: true,
        ambient_secondary_ok: true,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      },
      {
        streetlight_id: "LW-00043",
        tenant_id: TENANT_ID,
        health: "OK",
        lat: 47.6112,
        lng: -122.2025,
        name: "secondary",
        last_seen: new Date().toISOString(),
        motion_detected: false,
        ambient_primary_ok: true,
        ambient_secondary_ok: true,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      },
    ];

    return mergeLocalMeta(mock);
  }

  const data = await request("/streetlights", { method: "GET" });
  const rows = normalizeStreetlightListResponse(data);
  return mergeLocalMeta(rows);
}

export async function getStreetlight(id) {
  const { USE_MOCK, TENANT_ID } = env();

  if (!id) {
    throw new Error("streetlight id is required");
  }

  if (USE_MOCK) {
    const mock = {
      streetlight_id: id,
      tenant_id: TENANT_ID,
      health: "OK",
      lat: 47.6101,
      lng: -122.2015,
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

  const data = await request(`/streetlights/${encodeURIComponent(id)}`, {
    method: "GET",
  });

  return mergeLocalMeta([data])[0];
}

export async function getStreetlightTelemetry(id, { from, to, interval = "5m" } = {}) {
  const { USE_MOCK } = env();

  if (!id) {
    throw new Error("streetlight id is required");
  }

  if (!from || !to) {
    throw new Error("from and to are required");
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    throw new Error(
      `interval must be one of: ${Array.from(ALLOWED_INTERVALS).join(", ")}`
    );
  }

  if (USE_MOCK) {
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    const step = Math.max(Math.floor((end - start) / 20), 60 * 1000);

    const rows = [];
    for (let ts = start; ts <= end; ts += step) {
      rows.push({
        time: new Date(ts).toISOString(),
        lux: Number((20 + Math.random() * 80).toFixed(2)),
        temperature_c: Number((15 + Math.random() * 12).toFixed(1)),
        humidity_pct: Number((45 + Math.random() * 30).toFixed(1)),
        light_level_pct: Number((10 + Math.random() * 90).toFixed(1)),
      });
    }

    return {
      streetlight_id: id,
      data: rows,
    };
  }

  const data = await request(`/streetlights/${encodeURIComponent(id)}/telemetry`, {
    method: "GET",
    query: {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      interval,
    },
  });

  return {
    streetlight_id: id,
    data: normalizeTelemetryResponse(data),
  };
}

export async function updateStreetlightMetadata(id, body) {
  const { USE_MOCK } = env();

  if (!id) {
    throw new Error("streetlight id is required");
  }

  if (!body || typeof body !== "object") {
    throw new Error("body is required");
  }

  if (USE_MOCK) {
    return {
      message: "updated (mock)",
      streetlight_id: id,
      metadata: body,
    };
  }

  return request(`/streetlights/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body,
  });
}

const api = {
  listStreetlights,
  getStreetlight,
  getStreetlightTelemetry,
  updateStreetlightMetadata,
};

export default api;
