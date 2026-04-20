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

export const OVERVIEW_WORKING_POLE_ID = "LW-00100";

export function getOverviewPoleList(
  poles,
  preferredId = OVERVIEW_WORKING_POLE_ID
) {
  const rows = Array.isArray(poles) ? poles : [];
  const targetId = String(preferredId || "").trim();

  if (!rows.length) return [];

  if (targetId) {
    const preferredPole = rows.find(
      (pole) => String(pole?.streetlight_id || "").trim() === targetId
    );

    if (preferredPole) return [preferredPole];
  }

  return rows.slice(0, 1);
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
