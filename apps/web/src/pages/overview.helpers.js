function normalizeSensorHealth(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return null;
  return text;
}

function isSensorFault(value) {
  return [
    "TOTAL_FAILURE",
    "PRIMARY_FAIL",
    "SECONDARY_FAIL",
    "CRITICAL",
    "FAULT",
    "FAILED",
    "FAILURE",
  ].includes(normalizeSensorHealth(value));
}

function isSensorWarning(value) {
  return ["DEGRADED", "WARNING"].includes(normalizeSensorHealth(value));
}

function sensorHealthFromText(value) {
  const health = normalizeSensorHealth(value);
  if (!health) return null;

  if (isSensorFault(health)) {
    return { value: "Critical", tone: "critical" };
  }

  if (isSensorWarning(health)) {
    return { value: "Degraded", tone: "warning" };
  }

  if (["SYSTEM_OK", "OK", "HEALTHY", "CONNECTED"].includes(health)) {
    return { value: "OK", tone: "healthy" };
  }

  return { value: health.replaceAll("_", " "), tone: "neutral" };
}

function sensorHealthFromBool(value) {
  if (value === true) return { value: "OK", tone: "healthy" };
  if (value === false) return { value: "Critical", tone: "critical" };
  return null;
}

function sensorHealthFromPair(primary, secondary) {
  const checks = [primary, secondary].filter((value) => value !== null && value !== undefined);
  if (!checks.length) return null;
  if (checks.some((value) => value === false)) {
    return { value: "Critical", tone: "critical" };
  }
  if (checks.every((value) => value === true)) {
    return { value: "OK", tone: "healthy" };
  }
  return null;
}

function waitingSensorHealth() {
  return { value: "Waiting for data", tone: "neutral" };
}

function sensorHealthDetail(label, ...candidates) {
  return {
    label,
    ...(candidates.find(Boolean) || waitingSensorHealth()),
  };
}

export const POLE_OFFLINE_THRESHOLD_MS = 60 * 1000;

export function getOverviewPoleList(poles) {
  const rows = Array.isArray(poles) ? poles : [];

  if (!rows.length) return [];

  return rows
    .filter((pole) => String(pole?.streetlight_id || "").trim())
    .sort((a, b) =>
      String(a.streetlight_id || "").localeCompare(String(b.streetlight_id || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
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

export function getOverviewConnectionSummary(
  poles,
  nowValue = Date.now(),
  thresholdMs = POLE_OFFLINE_THRESHOLD_MS
) {
  const rows = getOverviewPoleList(poles);
  const total = rows.length;
  const online = rows.filter(
    (pole) => !isPoleTelemetryStale(pole, nowValue, thresholdMs)
  ).length;
  const offline = total - online;

  if (!total) {
    return {
      total,
      online,
      offline,
      status: "No Streetlights",
      note: "Waiting for streetlight inventory",
      tone: "neutral",
    };
  }

  if (!offline) {
    return {
      total,
      online,
      offline,
      status: "All Online",
      note: `${online} streetlight${online === 1 ? "" : "s"} reporting`,
      tone: "healthy",
    };
  }

  if (!online) {
    return {
      total,
      online,
      offline,
      status: "All Offline",
      note: `${offline} streetlight${offline === 1 ? "" : "s"} offline`,
      tone: "offline",
    };
  }

  return {
    total,
    online,
    offline,
    status: `${online}/${total} Online`,
    note: `${offline} offline / ${total} total`,
    tone: "offline",
  };
}

export function getSensorHealthDetails(pole) {
  const diagnostics = pole?.diagnostics || {};
  const overallOk =
    diagnostics?.overall_ok ?? pole?.overall_ok ?? null;
  const ambientHealth =
    diagnostics?.ambient_health ?? pole?.ambient_health ?? null;
  const mmwaveHealth =
    diagnostics?.mmwave_health ?? pole?.mmwave_health ?? null;
  const thOk = diagnostics?.th_ok ?? pole?.th_ok ?? null;
  const lightOk = diagnostics?.light_ok ?? pole?.light_ok ?? null;
  const ambientStatus = sensorHealthFromText(ambientHealth);
  const temperatureHumidityStatus = sensorHealthFromBool(thOk);
  const lightStatus = sensorHealthFromBool(lightOk);
  const rows = [];
  const systemStatus =
    sensorHealthFromBool(overallOk) || sensorHealthFromText(pole?.health);

  if (systemStatus) {
    rows.push(sensorHealthDetail("System", systemStatus));
  }

  rows.push(
    sensorHealthDetail(
      "Motion",
      sensorHealthFromText(mmwaveHealth),
      sensorHealthFromPair(pole?.motion_primary_ok, pole?.motion_secondary_ok)
    ),
    sensorHealthDetail("Brightness", lightStatus, ambientStatus),
    sensorHealthDetail("Temperature", temperatureHumidityStatus, ambientStatus),
    sensorHealthDetail("Humidity", temperatureHumidityStatus, ambientStatus),
    sensorHealthDetail("Lux", lightStatus, ambientStatus)
  );

  return rows;
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

export function getOverviewFaultSummary(poles, nowValue = Date.now()) {
  const reportingPoles = getOverviewPoleList(poles).filter(
    (pole) => !isPoleTelemetryStale(pole, nowValue)
  );

  return reportingPoles.reduce(
    (summary, pole) => {
      const health = getCombinedSensorHealth(pole);
      if (health.tone === "critical") {
        return { ...summary, critical: summary.critical + 1 };
      }
      if (health.tone === "warning") {
        return { ...summary, warning: summary.warning + 1 };
      }
      return summary;
    },
    { critical: 0, warning: 0 }
  );
}

export function getOverviewMarkerTone(pole, nowValue = Date.now()) {
  if (isPoleTelemetryStale(pole, nowValue)) {
    return "offline";
  }

  const health = getCombinedSensorHealth(pole);
  if (health.tone === "critical" || health.tone === "warning") {
    return health.tone;
  }

  if (pole?.motion_detected === true) {
    return "active";
  }

  return "healthy";
}
