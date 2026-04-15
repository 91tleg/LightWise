export function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function asNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toBoolOrNull(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Boolean(value);
  return null;
}

function toTextOrNull(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function compactObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined)
  );
}

export function validateCoordinate(value, type) {
  if (!String(value || "").trim()) return "";

  const num = Number(value);
  if (!Number.isFinite(num)) return `${type} must be a valid number.`;

  if (type === "Latitude" && (num < -90 || num > 90)) {
    return "Latitude must be between -90 and 90.";
  }

  if (type === "Longitude" && (num < -180 || num > 180)) {
    return "Longitude must be between -180 and 180.";
  }

  return "";
}

export function motionLabel(motion) {
  return motion === true ? "Detected" : "Clear";
}

export function toneForHealth(value) {
  const health = String(value || "").toUpperCase();

  if (health === "CRITICAL") return "critical";
  if (health === "DEGRADED" || health === "WARNING") return "warning";
  if (health === "OK" || health === "HEALTHY" || health === "CONNECTED") {
    return "healthy";
  }

  return "neutral";
}

export function toneForPole(snapshot) {
  if (snapshot?.motion_detected === true) return "active";
  return toneForHealth(snapshot?.health);
}

export function snapshotFromPole(pole) {
  if (!pole || typeof pole !== "object") return null;

  const diagnostics = pole?.diagnostics || {};

  return {
    timestamp: pole?.last_seen ?? null,
    health: pole?.health ?? null,
    motion_detected:
      typeof pole?.motion_detected === "boolean" ? pole.motion_detected : null,
    light_level: pole?.light_level ?? null,
    diagnostics: {
      overall_ok:
        diagnostics?.overall_ok ?? pole?.overall_ok ?? null,
      ambient_health:
        diagnostics?.ambient_health ?? pole?.ambient_health ?? null,
      mmwave_health:
        diagnostics?.mmwave_health ?? pole?.mmwave_health ?? null,
      th_ok: diagnostics?.th_ok ?? pole?.th_ok ?? null,
      light_ok: diagnostics?.light_ok ?? pole?.light_ok ?? null,
    },
    overall_ok: diagnostics?.overall_ok ?? pole?.overall_ok ?? null,
    ambient_health:
      diagnostics?.ambient_health ?? pole?.ambient_health ?? null,
    mmwave_health:
      diagnostics?.mmwave_health ?? pole?.mmwave_health ?? null,
    light_ok: diagnostics?.light_ok ?? pole?.light_ok ?? null,
    th_ok: diagnostics?.th_ok ?? pole?.th_ok ?? null,
    ambient_primary_ok: pole?.ambient_primary_ok ?? null,
    ambient_secondary_ok: pole?.ambient_secondary_ok ?? null,
    motion_primary_ok: pole?.motion_primary_ok ?? null,
    motion_secondary_ok: pole?.motion_secondary_ok ?? null,
    temp_c: pole?.temp_c ?? null,
    humidity: pole?.humidity ?? null,
    lux: pole?.lux ?? null,
    motion_focus_lat: pole?.motion_focus_lat ?? null,
    motion_focus_lng: pole?.motion_focus_lng ?? null,
    motion_focus_radius_m: pole?.motion_focus_radius_m ?? null,
  };
}

export function snapshotFromTelemetryRow(row) {
  if (!row || typeof row !== "object") return null;

  return {
    timestamp: row?.timestamp ?? null,
    health: row?.health ?? null,
    motion_detected:
      typeof row?.motion === "boolean"
        ? row.motion
        : typeof row?.motion_detected === "boolean"
        ? row.motion_detected
        : null,
    light_level: clampPct(row?.light_level),
    temp_c: row?.temp_c ?? null,
    humidity: row?.humidity ?? null,
    lux: row?.lux ?? null,
  };
}

export function snapshotFromWsMessage(message) {
  if (!message || typeof message !== "object") return null;

  const data = message?.data || {};
  const diagnostics = message?.diagnostics || {};

  return {
    timestamp: message?.timestamp ?? null,
    health: message?.health ?? null,
    motion_detected: toBoolOrNull(data?.motion_detected ?? data?.motion),
    light_level: clampPct(data?.light_level ?? data?.light_level_pct),
    diagnostics: {
      overall_ok: toBoolOrNull(diagnostics?.overall_ok),
      ambient_health: toTextOrNull(diagnostics?.ambient_health),
      mmwave_health: toTextOrNull(diagnostics?.mmwave_health),
      th_ok: toBoolOrNull(diagnostics?.th_ok),
      light_ok: toBoolOrNull(diagnostics?.light_ok),
    },
    overall_ok: toBoolOrNull(diagnostics?.overall_ok),
    ambient_health: toTextOrNull(diagnostics?.ambient_health),
    mmwave_health: toTextOrNull(diagnostics?.mmwave_health),
    th_ok: toBoolOrNull(diagnostics?.th_ok),
    light_ok: toBoolOrNull(diagnostics?.light_ok),
    ambient_primary_ok: toBoolOrNull(diagnostics?.ambient_primary_ok),
    ambient_secondary_ok: toBoolOrNull(diagnostics?.ambient_secondary_ok),
    motion_primary_ok: toBoolOrNull(diagnostics?.motion_primary_ok),
    motion_secondary_ok: toBoolOrNull(diagnostics?.motion_secondary_ok),
    temp_c: typeof data?.temp_c === "number" ? data.temp_c : undefined,
    humidity:
      typeof data?.humidity === "number"
        ? data.humidity
        : typeof data?.humidity_pct === "number"
        ? data.humidity_pct
        : undefined,
    lux: typeof data?.lux === "number" ? data.lux : undefined,
    motion_focus_lat: asNumberOrNull(message?.motion_focus_lat),
    motion_focus_lng: asNumberOrNull(message?.motion_focus_lng),
    motion_focus_radius_m: asNumberOrNull(message?.motion_focus_radius_m),
  };
}

export function mergeTelemetrySnapshot(existing = {}, snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") return { ...(existing || {}) };

  return {
    ...(existing || {}),
    ...(snapshot.timestamp ? { timestamp: snapshot.timestamp } : {}),
    ...(snapshot.health != null ? { health: snapshot.health } : {}),
    ...(typeof snapshot.motion_detected === "boolean"
      ? { motion_detected: snapshot.motion_detected }
      : {}),
    ...(snapshot.light_level != null ? { light_level: snapshot.light_level } : {}),
    ...(snapshot.diagnostics
      ? {
          diagnostics: {
            ...((existing || {}).diagnostics || {}),
            ...compactObject(snapshot.diagnostics),
          },
        }
      : {}),
    ...(snapshot.overall_ok != null ? { overall_ok: snapshot.overall_ok } : {}),
    ...(snapshot.ambient_health != null
      ? { ambient_health: snapshot.ambient_health }
      : {}),
    ...(snapshot.mmwave_health != null
      ? { mmwave_health: snapshot.mmwave_health }
      : {}),
    ...(snapshot.light_ok != null ? { light_ok: snapshot.light_ok } : {}),
    ...(snapshot.ambient_primary_ok != null
      ? { ambient_primary_ok: snapshot.ambient_primary_ok }
      : {}),
    ...(snapshot.ambient_secondary_ok != null
      ? { ambient_secondary_ok: snapshot.ambient_secondary_ok }
      : {}),
    ...(snapshot.th_ok != null ? { th_ok: snapshot.th_ok } : {}),
    ...(snapshot.motion_primary_ok != null
      ? { motion_primary_ok: snapshot.motion_primary_ok }
      : {}),
    ...(snapshot.motion_secondary_ok != null
      ? { motion_secondary_ok: snapshot.motion_secondary_ok }
      : {}),
    ...(snapshot.temp_c !== undefined ? { temp_c: snapshot.temp_c } : {}),
    ...(snapshot.humidity !== undefined ? { humidity: snapshot.humidity } : {}),
    ...(snapshot.lux !== undefined ? { lux: snapshot.lux } : {}),
    ...(snapshot.motion_focus_lat != null
      ? { motion_focus_lat: snapshot.motion_focus_lat }
      : {}),
    ...(snapshot.motion_focus_lng != null
      ? { motion_focus_lng: snapshot.motion_focus_lng }
      : {}),
    ...(snapshot.motion_focus_radius_m != null
      ? { motion_focus_radius_m: snapshot.motion_focus_radius_m }
      : {}),
  };
}

export function mergePoleSnapshot(pole = {}, snapshot = {}) {
  const baseSnapshot = snapshotFromPole(pole) || {};
  const mergedSnapshot = mergeTelemetrySnapshot(baseSnapshot, snapshot);

  return {
    ...pole,
    health: mergedSnapshot.health ?? pole?.health ?? null,
    motion_detected:
      typeof mergedSnapshot.motion_detected === "boolean"
        ? mergedSnapshot.motion_detected
        : pole?.motion_detected ?? null,
    light_level:
      mergedSnapshot.light_level != null
        ? mergedSnapshot.light_level
        : pole?.light_level ?? null,
    last_seen: mergedSnapshot.timestamp ?? pole?.last_seen ?? null,
    diagnostics: {
      ...((pole && typeof pole === "object" ? pole.diagnostics : {}) || {}),
      ...(mergedSnapshot.diagnostics || {}),
    },
    overall_ok:
      mergedSnapshot.overall_ok != null
        ? mergedSnapshot.overall_ok
        : pole?.overall_ok ?? pole?.diagnostics?.overall_ok ?? null,
    ambient_health:
      mergedSnapshot.ambient_health != null
        ? mergedSnapshot.ambient_health
        : pole?.ambient_health ?? pole?.diagnostics?.ambient_health ?? null,
    mmwave_health:
      mergedSnapshot.mmwave_health != null
        ? mergedSnapshot.mmwave_health
        : pole?.mmwave_health ?? pole?.diagnostics?.mmwave_health ?? null,
    light_ok:
      mergedSnapshot.light_ok != null
        ? mergedSnapshot.light_ok
        : pole?.light_ok ?? pole?.diagnostics?.light_ok ?? null,
    ambient_primary_ok:
      mergedSnapshot.ambient_primary_ok != null
        ? mergedSnapshot.ambient_primary_ok
        : pole?.ambient_primary_ok ?? null,
    ambient_secondary_ok:
      mergedSnapshot.ambient_secondary_ok != null
        ? mergedSnapshot.ambient_secondary_ok
        : pole?.ambient_secondary_ok ?? null,
    th_ok: mergedSnapshot.th_ok != null ? mergedSnapshot.th_ok : pole?.th_ok ?? null,
    motion_primary_ok:
      mergedSnapshot.motion_primary_ok != null
        ? mergedSnapshot.motion_primary_ok
        : pole?.motion_primary_ok ?? null,
    motion_secondary_ok:
      mergedSnapshot.motion_secondary_ok != null
        ? mergedSnapshot.motion_secondary_ok
        : pole?.motion_secondary_ok ?? null,
    temp_c: mergedSnapshot.temp_c !== undefined ? mergedSnapshot.temp_c : pole?.temp_c,
    humidity:
      mergedSnapshot.humidity !== undefined ? mergedSnapshot.humidity : pole?.humidity,
    lux: mergedSnapshot.lux !== undefined ? mergedSnapshot.lux : pole?.lux,
    motion_focus_lat:
      mergedSnapshot.motion_focus_lat != null
        ? mergedSnapshot.motion_focus_lat
        : pole?.motion_focus_lat ?? null,
    motion_focus_lng:
      mergedSnapshot.motion_focus_lng != null
        ? mergedSnapshot.motion_focus_lng
        : pole?.motion_focus_lng ?? null,
    motion_focus_radius_m:
      mergedSnapshot.motion_focus_radius_m != null
        ? mergedSnapshot.motion_focus_radius_m
        : pole?.motion_focus_radius_m ?? null,
  };
}

export function buildPoleEvent(streetlightId, snapshot, timestamp) {
  const eventTime = timestamp || snapshot?.timestamp || new Date().toISOString();

  return {
    id: `${streetlightId}-${eventTime}`,
    type: "update",
    tone: toneForPole(snapshot),
    label:
      typeof snapshot?.motion_detected === "boolean"
        ? snapshot.motion_detected
          ? "Motion detected"
          : "Motion cleared"
        : typeof snapshot?.light_level === "number"
        ? "Brightness updated"
        : snapshot?.health
        ? "Health status changed"
        : "Telemetry received",
    streetlightId,
    timestamp: eventTime,
    value:
      typeof snapshot?.light_level === "number"
        ? `${snapshot.light_level}% brightness`
        : snapshot?.lux != null
        ? `${Math.round(snapshot.lux)} lux`
        : "",
    note:
      snapshot?.health
        ? `Current health: ${snapshot.health}`
        : snapshot?.temp_c != null && snapshot?.humidity != null
        ? `Temp ${snapshot.temp_c}°C · Humidity ${snapshot.humidity}%`
        : undefined,
  };
}
