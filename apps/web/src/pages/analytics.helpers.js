import { formatDateTimeLocal, roundValue, safeNum } from "../utils/formatters";

const HEALTHY_STATES = new Set(["OK", "HEALTHY", "CONNECTED"]);
const WARNING_STATES = new Set(["WARNING", "DEGRADED"]);
const CRITICAL_STATES = new Set(["CRITICAL", "FAULT", "ERROR"]);
const OFFLINE_STATES = new Set(["OFFLINE", "UNKNOWN"]);

const DEFAULT_CENTER = {
  lat: 47.6101,
  lng: -122.2015,
};

const FIXTURE_KWH_PER_HOUR = 0.16;
const DAYLIGHT_LUX_THRESHOLD = 180;
const DEFAULT_LIGHT_LEVEL = 68;
const LIVE_RANGE_MS = 60 * 60 * 1000;
const TELEMETRY_INTERVALS = new Set([
  "5s", "10s", "30s",
  "1m", "5m", "10m", "15m", "30m",
  "1h", "6h", "12h",
  "1d", "7d", "30d",
]);
const INTERVAL_UNIT_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};
const INTERVAL_COERCION_RULES = [
  [30 * 24 * 60 * 60, "1d"],
  [7 * 24 * 60 * 60, "1h"],
  [24 * 60 * 60, "5m"],
  [6 * 60 * 60, "1m"],
];

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
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
    const numeric = Number(lowered);
    if (Number.isFinite(numeric)) return numeric > 0;
  }
  if (typeof value === "number") return value > 0;
  return null;
}

function parseTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function getValidCoord(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function average(values = []) {
  const list = values.filter((value) => Number.isFinite(value));
  if (!list.length) return null;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function sum(values = []) {
  return values
    .filter((value) => Number.isFinite(value))
    .reduce((total, value) => total + value, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function intervalToHours(interval) {
  const seconds = parseIntervalSeconds(interval);
  return seconds !== null ? seconds / (60 * 60) : 1;
}

function parseIntervalSeconds(interval) {
  const value = String(interval || "").trim();
  const match = value.match(/^(\d+(?:\.\d+)?)([smhd])$/);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const multiplier = INTERVAL_UNIT_SECONDS[match[2]];
  if (!Number.isFinite(amount) || !multiplier) return null;
  return amount * multiplier;
}

function escapeCsvValue(value) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getHealthLabel(health) {
  if (WARNING_STATES.has(health)) return "Service warning";
  if (CRITICAL_STATES.has(health)) return "Critical outage";
  if (OFFLINE_STATES.has(health)) return "Reporting offline";
  return "Network event";
}

function isHealthyHealth(health) {
  return HEALTHY_STATES.has(health);
}

function isFaultHealth(health) {
  return WARNING_STATES.has(health) || CRITICAL_STATES.has(health) || OFFLINE_STATES.has(health);
}

function normalizeHealth(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "UNKNOWN";
  if (HEALTHY_STATES.has(text)) return "OK";
  if (WARNING_STATES.has(text)) return "WARNING";
  if (CRITICAL_STATES.has(text)) return "CRITICAL";
  if (OFFLINE_STATES.has(text)) return "OFFLINE";
  return text;
}

function getNetworkCenter(poles = []) {
  const coords = poles
    .map((pole) => ({
      lat: getValidCoord(pole?.lat),
      lng: getValidCoord(pole?.lng),
    }))
    .filter((point) => point.lat !== null && point.lng !== null);

  if (!coords.length) return DEFAULT_CENTER;

  return {
    lat: average(coords.map((point) => point.lat)) ?? DEFAULT_CENTER.lat,
    lng: average(coords.map((point) => point.lng)) ?? DEFAULT_CENTER.lng,
  };
}

export function deriveZoneLabel(pole, center = DEFAULT_CENTER) {
  const lat = getValidCoord(pole?.lat);
  const lng = getValidCoord(pole?.lng);

  if (lat === null || lng === null) return "Unassigned";

  const latDiff = lat - center.lat;
  const lngDiff = lng - center.lng;

  if (Math.abs(latDiff) <= 0.0014 && Math.abs(lngDiff) <= 0.0014) {
    return "Central";
  }

  const northSouth = latDiff >= 0 ? "North" : "South";
  const eastWest = lngDiff >= 0 ? "East" : "West";
  return `${northSouth} ${eastWest}`;
}

function getLightingDemandFactor(row) {
  const lux = safeNum(row?.lux);
  if (lux !== null) {
    if (lux >= DAYLIGHT_LUX_THRESHOLD) return 0.18;
    if (lux >= DAYLIGHT_LUX_THRESHOLD * 0.6) return 0.42;
    return 1;
  }

  const time = parseTimestamp(row?.timestamp);
  if (time === null) return 1;

  const hour = new Date(time).getHours();
  return hour >= 6 && hour < 18 ? 0.22 : 1;
}

function estimateEnergyForRow(row, intervalHours) {
  const demandFactor = getLightingDemandFactor(row);
  const baselineKwh = FIXTURE_KWH_PER_HOUR * intervalHours * demandFactor;
  const lightLevel = safeNum(row?.light_level);
  const outputFactor = clamp((lightLevel ?? DEFAULT_LIGHT_LEVEL) / 100, 0.18, 1);
  const actualKwh = baselineKwh * outputFactor;

  return {
    baselineKwh: roundValue(baselineKwh, 3) ?? 0,
    actualKwh: roundValue(actualKwh, 3) ?? 0,
    savedKwh: roundValue(Math.max(0, baselineKwh - actualKwh), 3) ?? 0,
  };
}

function sortTelemetryRows(rows = []) {
  return [...rows].sort((left, right) => {
    const leftTs = parseTimestamp(left?.timestamp);
    const rightTs = parseTimestamp(right?.timestamp);

    if (leftTs === null && rightTs === null) return 0;
    if (leftTs === null) return 1;
    if (rightTs === null) return -1;
    return leftTs - rightTs;
  });
}

function buildFaultTimelineForPole(pole, rows = []) {
  const events = [];
  let openFault = null;

  rows.forEach((row) => {
    const health = row?.health ? normalizeHealth(row.health) : null;
    const timestamp = row?.timestamp;

    if (!timestamp || !health || health === "UNKNOWN") {
      return;
    }

    if (isFaultHealth(health)) {
      if (openFault !== health) {
        if (openFault) {
          events.push({
            poleId: pole?.streetlight_id || "",
            poleName: pole?.name || pole?.streetlight_id || "Unnamed pole",
            zone: row?.zone || "Unassigned",
            timestamp,
            health: openFault,
            type: getHealthLabel(openFault),
            status: "resolved",
            recurring: false,
          });
        }

        openFault = health;
        events.push({
          poleId: pole?.streetlight_id || "",
          poleName: pole?.name || pole?.streetlight_id || "Unnamed pole",
          zone: row?.zone || "Unassigned",
          timestamp,
          health,
          type: getHealthLabel(health),
          status: "active",
          recurring: false,
        });
      }

      return;
    }

    if (openFault) {
      events.push({
        poleId: pole?.streetlight_id || "",
        poleName: pole?.name || pole?.streetlight_id || "Unnamed pole",
        zone: row?.zone || "Unassigned",
        timestamp,
        health: openFault,
        type: getHealthLabel(openFault),
        status: "resolved",
        recurring: false,
      });
      openFault = null;
    }
  });

  return {
    events,
    activeCount: openFault ? 1 : 0,
    resolvedCount: events.filter((event) => event.status === "resolved").length,
  };
}

function markRecurringFaults(events = []) {
  const counts = new Map();

  events
    .filter((event) => event.status === "active")
    .forEach((event) => {
      const key = `${event.poleId}:${event.type}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

  return events.map((event) => {
    const key = `${event.poleId}:${event.type}`;
    return {
      ...event,
      recurring: (counts.get(key) || 0) > 1,
    };
  });
}

function buildPoleSummary(pole, rows, intervalHours, zone) {
  const enrichedRows = rows.map((row) => {
    const energy = estimateEnergyForRow(row, intervalHours);
    const rowHealth = row?.health ? normalizeHealth(row.health) : null;

    return {
      ...row,
      zone,
      poleId: pole?.streetlight_id || "",
      poleName: pole?.name || pole?.streetlight_id || "Unnamed pole",
      health: rowHealth,
      actualKwh: energy.actualKwh,
      baselineKwh: energy.baselineKwh,
      savedKwh: energy.savedKwh,
      timestampValue: parseTimestamp(row?.timestamp),
    };
  });

  const healthRows = enrichedRows.filter((row) => row.health && row.health !== "UNKNOWN");
  const healthyRows = healthRows.filter((row) => isHealthyHealth(row.health));
  const motionRows = enrichedRows.filter((row) => typeof row.motion === "boolean");
  const motionHits = motionRows.filter((row) => row.motion).length;
  const faultTimeline = buildFaultTimelineForPole(pole, enrichedRows);

  return {
    streetlight_id: pole?.streetlight_id || "",
    name: pole?.name || pole?.streetlight_id || "Unnamed pole",
    health: normalizeHealth(pole?.health),
    zone,
    lat: getValidCoord(pole?.lat),
    lng: getValidCoord(pole?.lng),
    lastSeen: enrichedRows[enrichedRows.length - 1]?.timestamp || null,
    actualEnergyKwh: roundValue(sum(enrichedRows.map((row) => row.actualKwh)), 2) ?? 0,
    baselineEnergyKwh: roundValue(sum(enrichedRows.map((row) => row.baselineKwh)), 2) ?? 0,
    energySavedKwh: roundValue(sum(enrichedRows.map((row) => row.savedKwh)), 2) ?? 0,
    uptimePct:
      healthRows.length > 0
        ? roundValue((healthyRows.length / healthRows.length) * 100, 1)
        : null,
    motionRatePct:
      motionRows.length > 0
        ? roundValue((motionHits / motionRows.length) * 100, 1)
        : null,
    activeFaults: faultTimeline.activeCount,
    faultsResolved: faultTimeline.resolvedCount,
    totalTelemetryRows: enrichedRows.length,
    healthSamples: healthRows.length,
    motionSamples: motionRows.length,
    rows: enrichedRows,
    faults: faultTimeline.events,
  };
}

function groupZones(poleSummaries = []) {
  const zoneMap = new Map();

  poleSummaries.forEach((pole) => {
    const key = pole.zone || "Unassigned";
    const current = zoneMap.get(key) || {
      zone: key,
      poleCount: 0,
      actualEnergyKwh: 0,
      baselineEnergyKwh: 0,
      energySavedKwh: 0,
      uptimeWeightedTotal: 0,
      uptimeWeight: 0,
      motionWeightedTotal: 0,
      motionWeight: 0,
      faultsResolved: 0,
      activeFaults: 0,
      poles: [],
    };

    current.poleCount += 1;
    current.actualEnergyKwh += pole.actualEnergyKwh;
    current.baselineEnergyKwh += pole.baselineEnergyKwh;
    current.energySavedKwh += pole.energySavedKwh;
    current.faultsResolved += pole.faultsResolved;
    current.activeFaults += pole.activeFaults;
    current.poles.push(pole);

    if (pole.uptimePct !== null) {
      current.uptimeWeightedTotal += pole.uptimePct * Math.max(pole.healthSamples, 1);
      current.uptimeWeight += Math.max(pole.healthSamples, 1);
    }

    if (pole.motionRatePct !== null) {
      current.motionWeightedTotal += pole.motionRatePct * Math.max(pole.motionSamples, 1);
      current.motionWeight += Math.max(pole.motionSamples, 1);
    }

    zoneMap.set(key, current);
  });

  return [...zoneMap.values()].map((zone) => ({
    zone: zone.zone,
    poleCount: zone.poleCount,
    actualEnergyKwh: roundValue(zone.actualEnergyKwh, 2) ?? 0,
    baselineEnergyKwh: roundValue(zone.baselineEnergyKwh, 2) ?? 0,
    energySavedKwh: roundValue(zone.energySavedKwh, 2) ?? 0,
    uptimePct:
      zone.uptimeWeight > 0 ? roundValue(zone.uptimeWeightedTotal / zone.uptimeWeight, 1) : null,
    motionRatePct:
      zone.motionWeight > 0 ? roundValue(zone.motionWeightedTotal / zone.motionWeight, 1) : null,
    faultsResolved: zone.faultsResolved,
    activeFaults: zone.activeFaults,
    poles: zone.poles.sort((left, right) => right.energySavedKwh - left.energySavedKwh),
  }));
}

function buildEnergySeries(poleSummaries = []) {
  const buckets = new Map();

  poleSummaries.forEach((pole) => {
    pole.rows.forEach((row) => {
      if (!row?.timestamp) return;

      const key = row.timestampValue ?? row.timestamp;
      const current = buckets.get(key) || {
        timestamp: row.timestamp,
        timestampValue: row.timestampValue ?? parseTimestamp(row.timestamp),
        actualKwh: 0,
        baselineKwh: 0,
      };

      current.actualKwh += row.actualKwh;
      current.baselineKwh += row.baselineKwh;
      buckets.set(key, current);
    });
  });

  return [...buckets.values()]
    .sort((left, right) => (left.timestampValue ?? 0) - (right.timestampValue ?? 0))
    .map((point) => ({
      timestamp: point.timestamp,
      timestampValue: point.timestampValue,
      actualKwh: roundValue(point.actualKwh, 2) ?? 0,
      baselineKwh: roundValue(point.baselineKwh, 2) ?? 0,
      savedKwh: roundValue(Math.max(0, point.baselineKwh - point.actualKwh), 2) ?? 0,
    }));
}

function buildMetricSeries(metricBuckets = [], totalKey, countKey, transform = (value) => value) {
  return metricBuckets
    .filter((point) => point[countKey] > 0)
    .map((point) => ({
      timestamp: point.timestamp,
      timestampValue: point.timestampValue,
      value: roundValue(transform(point[totalKey] / point[countKey]), 1),
      sampleCount: point[countKey],
    }));
}

function buildNetworkMetricSeries(poleSummaries = []) {
  const buckets = new Map();

  poleSummaries.forEach((pole) => {
    pole.rows.forEach((row) => {
      if (!row?.timestamp) return;

      const key = row.timestampValue ?? row.timestamp;
      const current = buckets.get(key) || {
        timestamp: row.timestamp,
        timestampValue: row.timestampValue ?? parseTimestamp(row.timestamp),
        lightLevelTotal: 0,
        lightLevelCount: 0,
        luxTotal: 0,
        luxCount: 0,
        temperatureTotal: 0,
        temperatureCount: 0,
        humidityTotal: 0,
        humidityCount: 0,
        motionDetected: 0,
        motionCount: 0,
      };

      if (Number.isFinite(row?.light_level)) {
        current.lightLevelTotal += row.light_level;
        current.lightLevelCount += 1;
      }

      if (Number.isFinite(row?.lux)) {
        current.luxTotal += row.lux;
        current.luxCount += 1;
      }

      if (Number.isFinite(row?.temp_c)) {
        current.temperatureTotal += row.temp_c;
        current.temperatureCount += 1;
      }

      if (Number.isFinite(row?.humidity)) {
        current.humidityTotal += row.humidity;
        current.humidityCount += 1;
      }

      if (typeof row?.motion === "boolean") {
        current.motionDetected += row.motion ? 1 : 0;
        current.motionCount += 1;
      }

      buckets.set(key, current);
    });
  });

  const sortedBuckets = [...buckets.values()].sort(
    (left, right) => (left.timestampValue ?? 0) - (right.timestampValue ?? 0)
  );

  return {
    light_level: buildMetricSeries(sortedBuckets, "lightLevelTotal", "lightLevelCount"),
    lux: buildMetricSeries(sortedBuckets, "luxTotal", "luxCount"),
    temp_c: buildMetricSeries(sortedBuckets, "temperatureTotal", "temperatureCount"),
    humidity: buildMetricSeries(sortedBuckets, "humidityTotal", "humidityCount"),
    motion: buildMetricSeries(
      sortedBuckets,
      "motionDetected",
      "motionCount",
      (value) => value * 100
    ),
  };
}

function buildHourlyMotion(poleSummaries = []) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    detections: 0,
    samples: 0,
  }));

  poleSummaries.forEach((pole) => {
    pole.rows.forEach((row) => {
      if (typeof row.motion !== "boolean") return;
      const timestamp = parseTimestamp(row.timestamp);
      if (timestamp === null) return;

      const hour = new Date(timestamp).getHours();
      buckets[hour].samples += 1;
      if (row.motion) buckets[hour].detections += 1;
    });
  });

  return buckets.map((bucket) => ({
    hour: bucket.hour,
    label: formatHourLabel(bucket.hour),
    activityPct:
      bucket.samples > 0 ? roundValue((bucket.detections / bucket.samples) * 100, 1) ?? 0 : 0,
    detections: bucket.detections,
    samples: bucket.samples,
  }));
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
      item?._time ||
      item?.created_at ||
      `row-${idx}`;

    const data = item?.data || item;
    const rawMotion = data?.motion_detected ?? data?.motion;
    const rawHealth = item?.health ?? data?.health ?? null;

    return {
      timestamp,
      lux: roundWhole(data?.lux),
      temp_c: roundOneDecimal(
        data?.temp_c ?? data?.temperature_c ?? data?.temperature
      ),
      humidity: roundOneDecimal(
        data?.humidity ?? data?.humidity_pct ?? data?.hum_pct
      ),
      motion: toBoolean(rawMotion),
      motion_detected: toBoolean(rawMotion),
      light_level: roundWhole(
        data?.light_level ?? data?.light_level_pct ?? data?.light_pct
      ),
      health: rawHealth ? normalizeHealth(rawHealth) : null,
    };
  });
}

export function getPresetRange(preset, nowValue = new Date()) {
  const now = new Date(nowValue);
  const from = new Date(now);

  if (preset === "live") from.setTime(now.getTime() - LIVE_RANGE_MS);
  if (preset === "7d") from.setDate(now.getDate() - 7);
  if (preset === "30d") from.setDate(now.getDate() - 30);
  if (preset === "quarter") from.setMonth(now.getMonth() - 3);
  if (preset === "year") from.setFullYear(now.getFullYear() - 1);

  return {
    from: formatDateTimeLocal(from),
    to: formatDateTimeLocal(now),
  };
}

export function inferTelemetryInterval(from, to) {
  const fromMs = parseTimestamp(from);
  const toMs = parseTimestamp(to);

  if (fromMs === null || toMs === null || toMs <= fromMs) return "1h";

  const daySpan = (toMs - fromMs) / (1000 * 60 * 60 * 24);
  if (daySpan <= 45) return "1h";
  if (daySpan <= 180) return "6h";
  return "1d";
}

export function resolveTelemetryInterval(requested, from, to) {
  const requestedInterval = TELEMETRY_INTERVALS.has(requested)
    ? requested
    : inferTelemetryInterval(from, to);
  const requestedSeconds = parseIntervalSeconds(requestedInterval);
  const fromMs = parseTimestamp(from);
  const toMs = parseTimestamp(to);

  if (requestedSeconds === null || fromMs === null || toMs === null || toMs <= fromMs) {
    return requestedInterval;
  }

  const windowSeconds = (toMs - fromMs) / 1000;
  const rule = INTERVAL_COERCION_RULES.find(([thresholdSeconds]) => {
    return windowSeconds >= thresholdSeconds;
  });

  if (!rule) return requestedInterval;

  const minimumInterval = rule[1];
  const minimumSeconds = parseIntervalSeconds(minimumInterval);

  if (minimumSeconds !== null && requestedSeconds < minimumSeconds) {
    return minimumInterval;
  }

  return requestedInterval;
}

export function buildReportDateLabel(from, to) {
  const fromDate = parseTimestamp(from);
  const toDate = parseTimestamp(to);

  if (fromDate === null || toDate === null) return "Selected date range";

  return `${new Date(fromDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} - ${new Date(toDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function formatHourLabel(hour) {
  const normalized = Number(hour);
  const suffix = normalized >= 12 ? "PM" : "AM";
  const base = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${base}${suffix}`;
}

export function buildAnalyticsReport(streetlights = [], telemetryByPole = {}, options = {}) {
  const poles = Array.isArray(streetlights) ? streetlights : [];
  const center = getNetworkCenter(poles);
  const intervalHours = intervalToHours(options.interval || inferTelemetryInterval(options.from, options.to));

  const poleSummaries = poles.map((pole) => {
    const rawRows = sortTelemetryRows(normalizeTelemetryRows(telemetryByPole[pole?.streetlight_id]));
    const zone = deriveZoneLabel(pole, center);
    return buildPoleSummary(pole, rawRows, intervalHours, zone);
  });
  const reportingPoleSummaries = poleSummaries.filter(
    (pole) => pole.totalTelemetryRows > 0
  );

  const zones = groupZones(reportingPoleSummaries);
  const energySeries = buildEnergySeries(reportingPoleSummaries);
  const metricSeries = buildNetworkMetricSeries(reportingPoleSummaries);
  const hourlyMotion = buildHourlyMotion(reportingPoleSummaries);
  const faults = markRecurringFaults(
    reportingPoleSummaries.flatMap((pole) => pole.faults).sort((left, right) => {
      const leftTs = parseTimestamp(left?.timestamp) ?? 0;
      const rightTs = parseTimestamp(right?.timestamp) ?? 0;
      return rightTs - leftTs;
    })
  );

  const rawTelemetryRows = poleSummaries
    .flatMap((pole) => pole.rows)
    .sort((left, right) => (right.timestampValue ?? 0) - (left.timestampValue ?? 0));

  const hasTelemetry = rawTelemetryRows.length > 0;
  const healthSamples = sum(reportingPoleSummaries.map((pole) => pole.healthSamples));
  const healthyWeightedTotal = sum(
    reportingPoleSummaries.map((pole) =>
      pole.uptimePct !== null ? (pole.uptimePct / 100) * Math.max(pole.healthSamples, 1) : 0
    )
  );

  return {
    center,
    headline: {
      energySavedKwh: hasTelemetry
        ? roundValue(sum(reportingPoleSummaries.map((pole) => pole.energySavedKwh)), 1) ?? 0
        : null,
      uptimePct:
        healthSamples > 0
          ? roundValue((healthyWeightedTotal / healthSamples) * 100, 1)
          : null,
      faultsResolved: hasTelemetry
        ? sum(reportingPoleSummaries.map((pole) => pole.faultsResolved))
        : null,
      activeFaults: hasTelemetry
        ? sum(reportingPoleSummaries.map((pole) => pole.activeFaults))
        : null,
    },
    summary: {
      totalPoles: poleSummaries.length,
      reportingPoles: reportingPoleSummaries.length,
      totalZones: zones.length,
      telemetryRows: rawTelemetryRows.length,
      activeFaults: hasTelemetry
        ? sum(reportingPoleSummaries.map((pole) => pole.activeFaults))
        : null,
      resolvedFaults: hasTelemetry
        ? sum(reportingPoleSummaries.map((pole) => pole.faultsResolved))
        : null,
    },
    poles: poleSummaries,
    zones,
    energySeries,
    metricSeries,
    faults,
    motionMap: poleSummaries
      .filter(
        (pole) =>
          pole.lat !== null &&
          pole.lng !== null &&
          pole.motionSamples > 0 &&
          pole.motionRatePct !== null
      )
      .map((pole) => ({
        streetlight_id: pole.streetlight_id,
        name: pole.name,
        zone: pole.zone,
        lat: pole.lat,
        lng: pole.lng,
        health: pole.health,
        motionRatePct: pole.motionRatePct,
        motionSamples: pole.motionSamples,
        energySavedKwh: pole.energySavedKwh,
        activeFaults: pole.activeFaults,
      })),
    hourlyMotion,
    rawTelemetryRows,
  };
}

export function buildZoneCsv(report) {
  const rows = [
    [
      "zone",
      "row_type",
      "pole_id",
      "pole_name",
      "health",
      "uptime_pct",
      "motion_activity_pct",
      "energy_saved_kwh",
      "faults_resolved",
      "active_faults",
      "last_seen",
    ],
  ];

  (report?.zones || []).forEach((zone) => {
    rows.push([
      zone.zone,
      "zone",
      "",
      "",
      "",
      zone.uptimePct ?? "",
      zone.motionRatePct ?? "",
      zone.energySavedKwh ?? 0,
      zone.faultsResolved ?? 0,
      zone.activeFaults ?? 0,
      "",
    ]);

    (zone.poles || []).forEach((pole) => {
      rows.push([
        zone.zone,
        "pole",
        pole.streetlight_id,
        pole.name,
        pole.health,
        pole.uptimePct ?? "",
        pole.motionRatePct ?? "",
        pole.energySavedKwh ?? 0,
        pole.faultsResolved ?? 0,
        pole.activeFaults ?? 0,
        pole.lastSeen ?? "",
      ]);
    });
  });

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

export function buildRawTelemetryCsv(report) {
  const rows = [
    [
      "timestamp",
      "pole_id",
      "pole_name",
      "zone",
      "health",
      "motion",
      "light_level_pct",
      "lux",
      "temperature_c",
      "humidity_pct",
      "actual_kwh",
      "baseline_kwh",
      "saved_kwh",
    ],
  ];

  (report?.rawTelemetryRows || []).forEach((row) => {
    rows.push([
      row.timestamp,
      row.poleId,
      row.poleName,
      row.zone,
      row.health,
      typeof row.motion === "boolean" ? (row.motion ? "detected" : "clear") : "",
      row.light_level ?? "",
      row.lux ?? "",
      row.temp_c ?? "",
      row.humidity ?? "",
      row.actualKwh ?? 0,
      row.baselineKwh ?? 0,
      row.savedKwh ?? 0,
    ]);
  });

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}
