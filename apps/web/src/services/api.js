// ===== CONFIGURATION BLOCK =====
// These values are read from environment variables.
// They control whether we use mock data or real backend data,
// and where the backend API is located.
const USE_MOCK = String(process.env.REACT_APP_USE_MOCK || "true") !== "false";
const API_BASE = process.env.REACT_APP_API_BASE || "";
const API_KEY = process.env.REACT_APP_API_KEY || "";


// ===== API FUNCTION BLOCK =====
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
  // If mock mode is disabled, this sends a real HTTP request to the backend
  // to fetch telemetry data from the /telemetry endpoint.
  const res = await fetch(`${API_BASE}/telemetry`, {
    headers: { "X-API-Key": API_KEY },
  });

  // ===== ERROR HANDLING BLOCK =====
  // If the server response is not successful, we throw an error
  // so the UI can display an error message.
  if (!res.ok) throw new Error(`API error ${res.status}`);

  // ===== RESPONSE PARSING BLOCK =====
  // This converts the JSON response from the server into a JavaScript object
  // and returns it to the caller.
  return res.json();
}
