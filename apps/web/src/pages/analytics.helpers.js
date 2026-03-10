import { roundValue } from "../utils/formatters";

function roundWhole(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.round(num);
}

function roundOneDecimal(value) {
  if (value === null || value === undefined || value === "") return null;
  return roundValue(value, 1);
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

export function normalizeTelemetryRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.telemetry)
    ? payload.telemetry
    : [];

  return rows.map((item, idx) => {
    const timestamp =
      item?.timestamp ||
      item?.time ||
      item?.ts ||
      item?.measure_time ||
      item?.created_at ||
      `row-${idx}`;

    const data = item?.data || item;

    return {
      timestamp,
      lux: roundWhole(data?.lux),
      temp_c: roundOneDecimal(data?.temp_c ?? data?.temperature_c),
      humidity: roundOneDecimal(data?.humidity ?? data?.humidity_pct),
      motion: toBoolean(data?.motion),
      light_level: roundWhole(data?.light_level ?? data?.light_level_pct),
      health: item?.health || data?.health || "OK",
    };
  });
}