// src/utils/normalizeEvent.js

/**
 * normalizeEvent(raw)
 * Converts backend WS message payloads into a consistent "event" shape for ActivityFeed.
 *
 * Returns null if message isn't an event you want to show.
 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Max telemetry push format:
  // { tenant_id, streetlight_id, timestamp, health, data{lux,temp_c,humidity,motion,light_level}, diagnostics{...} }
  if (raw.streetlight_id && (raw.data || raw.diagnostics || raw.health)) {
    const ts = raw.timestamp || new Date().toISOString();

    const motion = raw.data?.motion;
    const lightLevel = raw.data?.light_level;
    const lux = raw.data?.lux;

    // Build a short "value" that looks good in ActivityFeed
    let value = "";
    if (typeof motion === "boolean") value += motion ? "motion" : "no motion";
    if (typeof lightLevel === "number") value += `${value ? " • " : ""}light ${lightLevel}`;
    if (typeof lux === "number") value += `${value ? " • " : ""}${lux} lux`;
    if (!value) value = raw.health || "telemetry";

    return {
      id: `${raw.streetlight_id}-${ts}-${Math.random().toString(16).slice(2)}`,
      type: "telemetry",
      timestamp: ts,
      streetlightId: raw.streetlight_id,
      value,
      note: raw.health ? `health: ${raw.health}` : "",
      raw,
    };
  }

  // Optional: status messages if your backend ever sends them
  if (raw.type === "status" || raw.event === "status") {
    const ts = raw.timestamp || new Date().toISOString();
    return {
      id: `status-${ts}-${Math.random().toString(16).slice(2)}`,
      type: "status",
      timestamp: ts,
      streetlightId: raw.streetlight_id || "",
      value: raw.message || raw.status || "status",
      note: "",
      raw,
    };
  }

  return null;
}