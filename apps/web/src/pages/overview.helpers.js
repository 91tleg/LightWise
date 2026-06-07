function normalizeSensorHealth(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return null;
  return text;
}

function isSensorFault(value) {
  return ["TOTAL_FAILURE", "PRIMARY_FAIL", "SECONDARY_FAIL"].includes(
    normalizeSensorHealth(value)
  );
}

function isSensorWarning(value) {
  return normalizeSensorHealth(value) === "DEGRADED";
}

export const POLE_OFFLINE_THRESHOLD_MS = 60 * 1000;

export function getOverviewPoleList(poles) {
  const rows = Array.isArray(poles) ? poles : [];

  if (!rows.length) return [];

  return rows.filter((pole) => String(pole?.streetlight_id || "").trim());
}

export function isPoleTelemetryStale(
  pole,
  nowValue = Date.now(),
  thresholdMs = POLE_OFFLINE_THRESHOLD_MS
) {
  const lastSeen = pole?.last_seen;
  if (!lastSeen) return true;

  const timestamp = new Date(lastSeen).getTime();
  const nowMs = nowValue instanceof Date ? nowValue.getTime() : Number(nowValue);

  if (!Number.isFinite(timestamp) || !Number.isFinite(nowMs)) {
    return true;
  }

  return nowMs - timestamp > thresholdMs;
}

export function getCombinedSensorHealth(pole) {
  const diagnostics = pole?.diagnostics || {};
  const overallOk =
    diagnostics?.overall_ok ?? pole?.overall_ok ?? null;
  const ambientHealth =
    diagnostics?.ambient_health ?? pole?.ambient_health ?? null;
  const mmwaveHealth =
    diagnostics?.mmwave_health ?? pole?.mmwave_health ?? null;
  const thOk = diagnostics?.th_ok ?? pole?.th_ok ?? null;
  const lightOk = diagnostics?.light_ok ?? pole?.light_ok ?? null;
  const legacyChecks = [
    pole?.ambient_primary_ok,
    pole?.ambient_secondary_ok,
    pole?.motion_primary_ok,
    pole?.motion_secondary_ok,
  ].filter((v) => v !== null && v !== undefined);

  const hasModernData =
    overallOk !== null ||
    ambientHealth !== null ||
    mmwaveHealth !== null ||
    thOk !== null ||
    lightOk !== null;

  if (!hasModernData && !legacyChecks.length) {
    return { label: "Waiting for data", tone: "neutral" };
  }

  if (
    overallOk === false ||
    thOk === false ||
    lightOk === false ||
    isSensorFault(ambientHealth) ||
    isSensorFault(mmwaveHealth) ||
    legacyChecks.some((value) => value === false)
  ) {
    return { label: "Fault detected", tone: "critical" };
  }

  if (isSensorWarning(ambientHealth) || isSensorWarning(mmwaveHealth)) {
    return { label: "Sensors degraded", tone: "warning" };
  }

  return { label: "All sensors OK", tone: "healthy" };
}
