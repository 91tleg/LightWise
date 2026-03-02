// apps/web/src/services/poleStorage.js

const KEY_POLES = "lightwise:poles:v1";
const KEY_META = "lightwise:polemeta:v1";

// default poles to start with (safe)
const DEFAULT_POLES = ["LW-00042"];

export function loadPoles() {
  try {
    const raw = localStorage.getItem(KEY_POLES);
    if (!raw) return DEFAULT_POLES;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_POLES;

    const cleaned = parsed.filter((x) => typeof x === "string" && x.trim().length > 0);
    return cleaned.length ? cleaned : DEFAULT_POLES;
  } catch {
    return DEFAULT_POLES;
  }
}

export function savePoles(poles) {
  try {
    if (!Array.isArray(poles)) return;
    localStorage.setItem(KEY_POLES, JSON.stringify(poles));
  } catch {
    // ignore
  }
}

// --------------------
// Pole metadata storage
// --------------------

function loadMetaMap() {
  try {
    const raw = localStorage.getItem(KEY_META);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveMetaMap(metaMap) {
  try {
    localStorage.setItem(KEY_META, JSON.stringify(metaMap || {}));
  } catch {
    // ignore
  }
}

/**
 * Returns { [streetlight_id]: { name?, lat?, lng? } }
 */
export function loadPoleMetaMap() {
  return loadMetaMap();
}

/**
 * Returns { name?, lat?, lng? } or null
 */
export function loadPoleMeta(streetlightId) {
  const id = String(streetlightId || "").trim();
  if (!id) return null;
  const map = loadMetaMap();
  return map[id] || null;
}

export function upsertPoleMeta(streetlightId, patch) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const map = loadMetaMap();
  const prev = map[id] || {};
  map[id] = { ...prev, ...(patch || {}) };
  saveMetaMap(map);
}

export function clearPoleMeta(streetlightId) {
  const id = String(streetlightId || "").trim();
  if (!id) return;

  const map = loadMetaMap();
  delete map[id];
  saveMetaMap(map);
}