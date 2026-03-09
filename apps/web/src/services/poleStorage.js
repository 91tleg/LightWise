const POLES_KEY = "lightwise_poles";
const META_KEY = "lightwise_pole_meta_map";

/* ----------------------------- */
/* basic safe localStorage utils */
/* ----------------------------- */
function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

/* ----------------------------- */
/* poles list API               */
/* used by LightWiseProvider    */
/* ----------------------------- */
export function loadPoles() {
  const value = safeRead(POLES_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function savePoles(poles) {
  safeWrite(POLES_KEY, Array.isArray(poles) ? poles : []);
}

/* ----------------------------- */
/* pole meta map API            */
/* used by Admin / Map_View     */
/* ----------------------------- */
export function loadPoleMetaMap() {
  const value = safeRead(META_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function savePoleMetaMap(metaMap) {
  safeWrite(META_KEY, metaMap && typeof metaMap === "object" ? metaMap : {});
}

export function getPoleMeta(streetlightId) {
  const id = String(streetlightId || "").trim();
  if (!id) return null;
  const map = loadPoleMetaMap();
  return map[id] || null;
}

export function upsertPoleMeta(streetlightId, patch = {}) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const map = loadPoleMetaMap();
  map[id] = {
    ...(map[id] || {}),
    streetlight_id: id,
    ...(patch || {}),
  };
  savePoleMetaMap(map);
}

export function removePoleMeta(streetlightId) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const map = loadPoleMetaMap();
  delete map[id];
  savePoleMetaMap(map);
}

export function clearPoleMeta(streetlightId) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const map = loadPoleMetaMap();
  if (!map[id]) return;

  map[id] = {
    ...(map[id] || {}),
    latitude: null,
    longitude: null,
  };

  savePoleMetaMap(map);
}

export function clearAllPoleMeta() {
  savePoleMetaMap({});
}

export function mergePoleWithLocalMeta(pole = {}) {
  const id = String(
    pole?.streetlight_id || pole?.id || pole?.streetlightId || ""
  ).trim();

  if (!id) return pole;

  const local = getPoleMeta(id);
  if (!local) return pole;

  return {
    ...pole,
    display_name:
      local.display_name ??
      pole.display_name ??
      pole.name ??
      pole.displayName ??
      "Unnamed pole",
    latitude:
      local.latitude ??
      pole.latitude ??
      pole.lat ??
      pole.coordinates?.latitude ??
      pole.coordinates?.lat ??
      null,
    longitude:
      local.longitude ??
      pole.longitude ??
      pole.lng ??
      pole.coordinates?.longitude ??
      pole.coordinates?.lng ??
      null,
  };
}

/* ----------------------------- */
/* compatibility exports        */
/* so older code stops breaking */
/* ----------------------------- */

export function savePoleCoords(streetlightId, latitude, longitude) {
  upsertPoleMeta(streetlightId, { latitude, longitude });
}

export function clearPoleCoords(streetlightId) {
  clearPoleMeta(streetlightId);
}

export function readCoordsCache() {
  const map = loadPoleMetaMap();
  const coords = {};

  Object.keys(map).forEach((id) => {
    coords[id] = {
      latitude: map[id]?.latitude ?? null,
      longitude: map[id]?.longitude ?? null,
    };
  });

  return coords;
}

export function writeCoordsCache(value) {
  const input = value && typeof value === "object" ? value : {};
  const map = loadPoleMetaMap();

  Object.keys(input).forEach((id) => {
    map[id] = {
      ...(map[id] || {}),
      streetlight_id: id,
      latitude: input[id]?.latitude ?? null,
      longitude: input[id]?.longitude ?? null,
    };
  });

  savePoleMetaMap(map);
}

export function mergeCoordsWithBackend(streetlights = []) {
  return (Array.isArray(streetlights) ? streetlights : []).map((pole) =>
    mergePoleWithLocalMeta(pole)
  );
}

/* telemetry compatibility no-op store */
const TELEMETRY_KEY = "lightwise_telemetry_cache";

export function readTelemetryCache() {
  const value = safeRead(TELEMETRY_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function writeTelemetryCache(value) {
  safeWrite(
    TELEMETRY_KEY,
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  );
}

export function savePoleTelemetry(streetlightId, telemetry = {}) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const cache = readTelemetryCache();
  cache[id] = {
    ...(cache[id] || {}),
    ...(telemetry || {}),
    data: {
      ...(cache[id]?.data || {}),
      ...(telemetry?.data || {}),
    },
    diagnostics: {
      ...(cache[id]?.diagnostics || {}),
      ...(telemetry?.diagnostics || {}),
    },
  };
  writeTelemetryCache(cache);
}

export function mergeTelemetryWithBackend(streetlights = []) {
  const telemetry = readTelemetryCache();

  return (Array.isArray(streetlights) ? streetlights : []).map((pole) => {
    const id = String(
      pole?.streetlight_id || pole?.id || pole?.streetlightId || ""
    ).trim();

    if (!id || !telemetry[id]) return pole;

    const local = telemetry[id];

    return {
      ...pole,
      ...local,
      data: {
        ...(pole.data || {}),
        ...(local.data || {}),
      },
      diagnostics: {
        ...(pole.diagnostics || {}),
        ...(local.diagnostics || {}),
      },
      last_seen:
        local.last_seen ??
        local.lastSeen ??
        local.timestamp ??
        pole.last_seen ??
        pole.lastSeen ??
        pole.timestamp ??
        null,
      motion:
        local.motion ??
        local.data?.motion ??
        pole.motion ??
        pole.data?.motion ??
        null,
      brightness_level:
        local.brightness_level ??
        local.data?.light_level ??
        pole.brightness_level ??
        pole.data?.light_level ??
        null,
      temperature:
        local.temperature ??
        local.temp_c ??
        local.data?.temp_c ??
        pole.temperature ??
        pole.temp_c ??
        pole.data?.temp_c ??
        null,
      humidity:
        local.humidity ??
        local.data?.humidity ??
        pole.humidity ??
        pole.data?.humidity ??
        null,
      health:
        local.health ??
        local.diagnostics?.overall_ok ??
        pole.health ??
        pole.diagnostics?.overall_ok ??
        "Unknown",
    };
  });
}

const poleStorage = {
  loadPoles,
  savePoles,
  loadPoleMetaMap,
  savePoleMetaMap,
  getPoleMeta,
  upsertPoleMeta,
  removePoleMeta,
  clearPoleMeta,
  clearAllPoleMeta,
  mergePoleWithLocalMeta,
  savePoleCoords,
  clearPoleCoords,
  readCoordsCache,
  writeCoordsCache,
  mergeCoordsWithBackend,
  readTelemetryCache,
  writeTelemetryCache,
  savePoleTelemetry,
  mergeTelemetryWithBackend,
};

export default poleStorage;