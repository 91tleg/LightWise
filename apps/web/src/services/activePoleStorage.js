const ACTIVE_POLE_KEY = "lightwise_active_pole_id";

export function readActivePoleId(fallback = null) {
  try {
    const raw = localStorage.getItem(ACTIVE_POLE_KEY);
    const value = String(raw || "").trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

export function writeActivePoleId(streetlightId) {
  const value = String(streetlightId || "").trim();
  if (!value) return;

  try {
    localStorage.setItem(ACTIVE_POLE_KEY, value);
  } catch {}
}
