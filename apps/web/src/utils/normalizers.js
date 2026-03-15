export function normalizeOperatorProfile(raw = {}) {
  return {
    sub:       raw.sub ?? "",
    tenantId:  raw.tenant_id ?? raw["custom:tenant_id"] ?? "",
    firstName: raw.given_name ?? raw.first_name ?? "",
    lastName:  raw.family_name ?? raw.last_name ?? "",
    name:      raw.name ?? `${raw.given_name ?? ""} ${raw.family_name ?? ""}`.trim(),
    email:     raw.email ?? "",
    role:      raw.role ?? "operator",
  };
}

export function normalizeStreetlightListResponse(data) {
  if (Array.isArray(data))               return data;
  if (Array.isArray(data?.items))        return data.items;
  if (Array.isArray(data?.data))         return data.data;
  if (Array.isArray(data?.streetlights)) return data.streetlights;
  return [];
}

export function normalizeTelemetryResponse(data) {
  if (Array.isArray(data))            return data;
  if (Array.isArray(data?.items))     return data.items;
  if (Array.isArray(data?.data))      return data.data;
  if (Array.isArray(data?.telemetry)) return data.telemetry;
  return [];
}

/**
 * Converts raw WS message payloads into a consistent event shape for ActivityFeed.
 * Returns null if the message isn't a displayable event.
 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;

  const ts = raw.timestamp || new Date().toISOString();
  const id = (prefix) => `${prefix}-${ts}-${Math.random().toString(16).slice(2)}`;

  // Telemetry push: { tenant_id, streetlight_id, timestamp, health, data, diagnostics }
  if (raw.streetlight_id && (raw.data || raw.diagnostics || raw.health)) {
    const { motion, light_level: lightLevel, lux } = raw.data || {};

    const parts = [
      typeof motion     === "boolean" ? (motion ? "motion" : "no motion") : null,
      typeof lightLevel === "number"  ? `light ${lightLevel}`             : null,
      typeof lux        === "number"  ? `${lux} lux`                      : null,
    ].filter(Boolean);

    return {
      id:            id(raw.streetlight_id),
      type:          "telemetry",
      timestamp:     ts,
      streetlightId: raw.streetlight_id,
      value:         parts.length ? parts.join(" • ") : (raw.health || "telemetry"),
      note:          raw.health ? `health: ${raw.health}` : "",
      raw,
    };
  }

  // Status message
  if (raw.type === "status" || raw.event === "status") {
    return {
      id:            id("status"),
      type:          "status",
      timestamp:     ts,
      streetlightId: raw.streetlight_id || "",
      value:         raw.message || raw.status || "status",
      note:          "",
      raw,
    };
  }

  return null;
}
