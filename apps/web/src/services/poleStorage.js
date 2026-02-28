// src/services/poleStorage.js

const KEY = "lightwise:poles:v1";

// default poles to start with (safe)
const DEFAULT_POLES = ["LW-00042"];

export function loadPoles() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_POLES;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_POLES;

    // keep only strings
    const cleaned = parsed.filter((x) => typeof x === "string" && x.trim().length > 0);
    return cleaned.length ? cleaned : DEFAULT_POLES;
  } catch {
    return DEFAULT_POLES;
  }
}

export function savePoles(poles) {
  try {
    if (!Array.isArray(poles)) return;
    localStorage.setItem(KEY, JSON.stringify(poles));
  } catch {
    // ignore storage errors
  }
}