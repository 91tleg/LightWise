// src/services/api.js

// ===== CONFIGURATION BLOCK =====
// These values are read from environment variables.
// They control whether we use mock data or real backend data,
// and where the backend API is located.
const USE_MOCK = String(process.env.REACT_APP_USE_MOCK || "true") !== "false";
const API_BASE = process.env.REACT_APP_API_BASE || "";
const API_KEY = process.env.REACT_APP_API_KEY || "";

// ===== REQUEST ID / CORRELATION BLOCK =====
// Used for correlationId passthrough (#50).
// Backend can log this requestId so we can trace a frontend call end-to-end.
function makeRequestId() {
  // Modern browsers support this. If you need a fallback later, we can add one.
  return crypto.randomUUID();
}

// ===== SAFE JSON PARSE BLOCK =====
// Some backends may return empty body or non-JSON on errors.
// This safely returns null if JSON parsing fails.
async function parseJsonSafely(res) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ===== CORE REQUEST HELPER BLOCK =====
// Centralizes:
// - headers (API key + requestId)
// - stable JSON parsing
// - stable error mapping
async function request(path, options = {}) {
  const requestId = makeRequestId();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
      // Correlation ID passthrough (#50)
      "x-request-id": requestId,
      ...(options.headers || {}),
    },
  });

  const data = await parseJsonSafely(res);

  // ===== ERROR HANDLING BLOCK =====
  // Convert backend error shapes into a stable message for the UI.
  if (!res.ok) {
    // Supports common formats:
    // { error: { message } } OR { message } OR plain status fallback
    const message =
      data?.error?.message ||
      data?.message ||
      `API error ${res.status}`;

    const err = new Error(message);
    err.status = res.status;
    err.requestId = requestId; // useful to show/copy in UI or logs
    err.payload = data;        // keep raw payload for debugging
    throw err;
  }

  return data;
}

// ============================================================================
// ===== API FUNCTION BLOCKS =====
// ============================================================================

// ===== TELEMETRY FUNCTION BLOCK =====
// This function retrieves telemetry data for the system.
// It is called by the Overview page when the app loads.
export async function getTelemetry() {
  // ===== MOCK MODE BLOCK =====
  // If mock mode is enabled or no API base URL is set,
  // we return a fake telemetry object for demo and testing purposes.
  if (USE_MOCK || !API_BASE) {
    return {
      poleId: "LW-001",
      timestamp: new Date().toISOString(),
      ambientLux: null,
      motion: null,
      tempC: null,
      humidity: null,
      rssi: null,
    };
  }

  // ===== REAL API REQUEST BLOCK =====
  // Fetch telemetry data from the /telemetry endpoint.
  return request(`/telemetry`, { method: "GET" });
}

// ===== LIST DEVICES FUNCTION BLOCK (#49) =====
// input: userId (stubbed from headers for now on backend)
// output: devices owned by user
export async function listDevices() {
  // ===== MOCK MODE BLOCK =====
  if (USE_MOCK || !API_BASE) {
    return [
      { deviceId: "LW-001", name: "Pole LW-001", status: "online" },
      { deviceId: "LW-002", name: "Pole LW-002", status: "offline" },
    ];
  }

  // Backend might read userId from headers (stubbed).
  // If you have a header for userId, add it in request() call below.
  return request(`/devices`, { method: "GET" });
}

// ===== GET DEVICE STATE FUNCTION BLOCK (#49) =====
// input: deviceId
// output: latest DeviceState from Dynamo
export async function getDeviceState(deviceId) {
  if (!deviceId) throw new Error("deviceId is required");

  // ===== MOCK MODE BLOCK =====
  if (USE_MOCK || !API_BASE) {
    return {
      deviceId,
      timestamp: new Date().toISOString(),
      ambientLux: null,
      motion: null,
      tempC: null,
      humidity: null,
      rssi: null,
      status: "ok",
    };
  }

  // Adjust this path if Max names it differently.
  return request(`/devices/${encodeURIComponent(deviceId)}/state`, {
    method: "GET",
  });
}
