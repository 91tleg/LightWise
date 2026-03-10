export function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function roundValue(value, digits = 0) {
  const n = safeNum(value);
  if (n === null) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

export function formatDateTimeLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function formatTimestamp(ts, fallback = "Waiting for data") {
  if (!ts) return fallback;

  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return String(ts);

  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTableTimestamp(ts, fallback = "--") {
  if (!ts) return fallback;

  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return String(ts);

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}