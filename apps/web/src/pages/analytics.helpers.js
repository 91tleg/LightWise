import { roundValue } from "../utils/formatters";

export function normalizeTelemetryRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
    ? payload.data
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
      lux: roundValue(data?.lux, 0),
      temp_c: roundValue(data?.temp_c, 1),
      humidity: roundValue(data?.humidity, 1),
      motion:
        typeof data?.motion === "boolean"
          ? data.motion
          : String(data?.motion).toLowerCase() === "true",
      light_level: roundValue(data?.light_level, 0),
      health: item?.health || data?.health || "OK",
    };
  });
}