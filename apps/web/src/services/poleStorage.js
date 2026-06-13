const POLES_KEY = "lightwise_poles";
const META_KEY = "lightwise_pole_meta_map";
const TELEMETRY_KEY = "lightwise_telemetry_cache";
const ACTIVE_POLE_KEY = "lightwise_active_pole_id";
export const POLE_META_UPDATED_EVENT = "lightwise:pole-meta-updated";

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
    // localStorage can be unavailable in private mode.
  }
}

function emitPoleMetaUpdated() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(POLE_META_UPDATED_EVENT));
}

export function loadPoles() {
  const value = safeRead(POLES_KEY, []);
  return Array.isArray(value) ? value : [];
}

export function savePoles(poles) {
  safeWrite(POLES_KEY, Array.isArray(poles) ? poles : []);
}

export function loadPoleMetaMap() {
  const value = safeRead(META_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function savePoleMetaMap(metaMap) {
  safeWrite(META_KEY, metaMap && typeof metaMap === "object" ? metaMap : {});
  emitPoleMetaUpdated();
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
    lat: null,
    lng: null,
  };

  savePoleMetaMap(map);
}

export function clearAllPoleMeta() {
  savePoleMetaMap({});
}

export function subscribeToPoleMetaChanges(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }

  const handleChange = () => callback();
  window.addEventListener(POLE_META_UPDATED_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(POLE_META_UPDATED_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function mergePoleWithLocalMeta(pole = {}) {
  const id = String(pole?.streetlight_id || "").trim();
  if (!id) return pole;

  const local = getPoleMeta(id);
  if (!local) return pole;

  return {
    ...pole,
    name: local.name ?? pole.name ?? null,
    lat: local.lat ?? pole.lat ?? null,
    lng: local.lng ?? pole.lng ?? null,
  };
}

export function savePoleCoords(streetlightId, latitude, longitude) {
  upsertPoleMeta(streetlightId, {
    lat: latitude,
    lng: longitude,
  });
}

export function clearPoleCoords(streetlightId) {
  clearPoleMeta(streetlightId);
}

export function readCoordsCache() {
  const map = loadPoleMetaMap();
  const coords = {};

  Object.keys(map).forEach((id) => {
    coords[id] = {
      latitude: map[id]?.lat ?? null,
      longitude: map[id]?.lng ?? null,
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
      lat: input[id]?.latitude ?? null,
      lng: input[id]?.longitude ?? null,
    };
  });

  savePoleMetaMap(map);
}

export function mergeCoordsWithBackend(streetlights = []) {
  return (Array.isArray(streetlights) ? streetlights : []).map((pole) =>
    mergePoleWithLocalMeta(pole)
  );
}

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

export function deletePoleCompletely(streetlightId) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const metaMap = loadPoleMetaMap();
  if (metaMap[id]) {
    delete metaMap[id];
    savePoleMetaMap(metaMap);
  }

  const poles = loadPoles().filter((poleId) => String(poleId || "").trim() !== id);
  savePoles(poles);

  const telemetry = readTelemetryCache();
  if (telemetry[id]) {
    delete telemetry[id];
    writeTelemetryCache(telemetry);
  }

  try {
    if (localStorage.getItem(ACTIVE_POLE_KEY) === id) {
      localStorage.removeItem(ACTIVE_POLE_KEY);
    }
  } catch {
    // localStorage can be unavailable in private mode.
  }

  emitPoleMetaUpdated();
}

export function pruneStoredPoleState(validStreetlightIds = []) {
  const validIds = new Set(
    (Array.isArray(validStreetlightIds) ? validStreetlightIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  const pruneUnknownId = (id) => {
    const normalized = String(id || "").trim();
    return normalized && !validIds.has(normalized);
  };

  const metaMap = loadPoleMetaMap();
  const nextMetaMap = Object.fromEntries(
    Object.entries(metaMap).filter(([id]) => !pruneUnknownId(id))
  );
  if (Object.keys(nextMetaMap).length !== Object.keys(metaMap).length) {
    savePoleMetaMap(nextMetaMap);
  }

  const poles = loadPoles();
  const nextPoles = poles.filter((id) => !pruneUnknownId(id));
  if (nextPoles.length !== poles.length) {
    savePoles(nextPoles);
  }

  const telemetry = readTelemetryCache();
  const nextTelemetry = Object.fromEntries(
    Object.entries(telemetry).filter(([id]) => !pruneUnknownId(id))
  );
  if (Object.keys(nextTelemetry).length !== Object.keys(telemetry).length) {
    writeTelemetryCache(nextTelemetry);
  }

  try {
    if (pruneUnknownId(localStorage.getItem(ACTIVE_POLE_KEY))) {
      localStorage.removeItem(ACTIVE_POLE_KEY);
    }
  } catch {
    // localStorage can be unavailable in private mode.
  }

  emitPoleMetaUpdated();
}

export function mergeTelemetryWithBackend(streetlights = []) {
  const telemetry = readTelemetryCache();

  return (Array.isArray(streetlights) ? streetlights : []).map((pole) => {
    const id = String(pole?.streetlight_id || "").trim();

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
      last_seen: local.last_seen ?? local.timestamp ?? pole.last_seen ?? null,
      motion:
        local.motion ?? local.data?.motion ?? pole.motion ?? pole.data?.motion ?? null,
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
  subscribeToPoleMetaChanges,
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
  deletePoleCompletely,
  pruneStoredPoleState,
};

export default poleStorage;
