import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import UiIcon from "../components/UiIcon";
import { useOverviewData } from "../hooks/useOverviewData";
import { useLightWise } from "../hooks/useLightWise";
import { useWebSocketSync } from "../hooks/useWebSocketSync";
import { getStreetlightTelemetry } from "../services/api";
import { formatTableTimestamp } from "../utils/formatters";
import { toneForHealth } from "../utils/poleState";
import {
  buildAnalyticsReport,
  buildRawTelemetryCsv,
  buildReportDateLabel,
  buildZoneCsv,
  getPresetRange,
  inferTelemetryInterval,
  normalizeTelemetryRows,
  resolveTelemetryInterval,
} from "./analytics.helpers";
import { getOverviewPoleList } from "./overview.helpers";
import "../styles/lightwise.css";
import "../styles/analytics.css";

const RANGE_STORAGE_KEY = "lightwise.analytics.range.v2";

const RANGE_PRESETS = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

const AGGREGATION_OPTIONS = [
  { id: "auto", label: "Auto" },
  { id: "5m", label: "5 min" },
  { id: "10m", label: "10 min" },
  { id: "15m", label: "15 min" },
  { id: "30m", label: "30 min" },
  { id: "1h", label: "1 hour" },
  { id: "6h", label: "6 hours" },
  { id: "12h", label: "12 hours" },
  { id: "1d", label: "1 day" },
];

const LIVE_AGGREGATION_OPTIONS = [{ id: "auto", label: "Instant" }];

const FAULT_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "resolved", label: "Resolved" },
  { id: "recurring", label: "Recurring" },
];

const CHART_METRICS = {
  energy: {
    id: "energy",
    label: "Energy",
    title: "Energy Consumption",
    description: "Selected streetlight draw against the baseline lighting profile.",
  },
  light_level: {
    id: "light_level",
    label: "Brightness",
    title: "Brightness Intensity",
    description: "Average dimming output from returned telemetry.",
  },
  lux: {
    id: "lux",
    label: "Lux",
    title: "Lux",
    description: "Average ambient light level from returned telemetry.",
  },
  temp_c: {
    id: "temp_c",
    label: "Temperature",
    title: "Temperature",
    description: "Average reported fixture temperature from returned telemetry.",
  },
  humidity: {
    id: "humidity",
    label: "Humidity",
    title: "Humidity",
    description: "Average reported humidity from returned telemetry.",
  },
  motion: {
    id: "motion",
    label: "Motion",
    title: "Motion Activity",
    description: "Count of returned telemetry samples where motion was detected.",
  },
};

const CHART_METRIC_ORDER = [
  "energy",
  "light_level",
  "lux",
  "temp_c",
  "humidity",
  "motion",
];

const LIVE_RANGE_REFRESH_MS = 30000;
const LIVE_WINDOW_TICK_MS = 1000;
const LIVE_WINDOW_MS = 60 * 1000;
const LIVE_REQUEST_INTERVAL = "5s";
const LIVE_GRAPH_INTERVAL = "1s";
const LIVE_MAX_ROWS_PER_POLE = 240;
const MAX_UNIT_COUNT_TICK = 20;

function readStoredRange() {
  const fallback = getPresetRange("30d");

  try {
    const raw = window.localStorage.getItem(RANGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.from === "string" &&
      typeof parsed.to === "string" &&
      typeof parsed.preset === "string"
    ) {
      if (!RANGE_PRESETS.some((option) => option.id === parsed.preset)) {
        return {
          preset: "30d",
          from: fallback.from,
          to: fallback.to,
          aggregation: "auto",
        };
      }

      const aggregation = AGGREGATION_OPTIONS.some(
        (option) => option.id === parsed.aggregation
      )
        ? parsed.aggregation
        : "auto";

      return {
        ...parsed,
        aggregation,
      };
    }
  } catch {}

  return {
    preset: "30d",
    from: fallback.from,
    to: fallback.to,
    aggregation: "auto",
  };
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toBooleanOrNull(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
    const number = Number(lowered);
    if (Number.isFinite(number)) return number > 0;
  }
  return null;
}

function compactTelemetryRow(row) {
  return Object.fromEntries(
    Object.entries(row || {}).filter(([, value]) => value !== null && value !== undefined)
  );
}

function liveRowFromPole(pole, { timestamp } = {}) {
  const rowTimestamp = timestamp || pole?.last_seen;
  if (!pole?.streetlight_id || !rowTimestamp) return null;

  const row = compactTelemetryRow({
    timestamp: rowTimestamp,
    lux: toNumberOrNull(pole.lux),
    temp_c: toNumberOrNull(pole.temp_c),
    humidity: toNumberOrNull(pole.humidity),
    motion: toBooleanOrNull(pole.motion_detected),
    motion_detected: toBooleanOrNull(pole.motion_detected),
    light_level: toNumberOrNull(pole.light_level),
    health: pole.health || null,
  });

  return Object.keys(row).length > 2 ? row : null;
}

function liveRowFromWsMessage(message) {
  if (!message || typeof message !== "object" || !message.streetlight_id) return null;

  const data = message.data || {};
  const motion = toBooleanOrNull(data.motion_detected ?? data.motion);
  const row = compactTelemetryRow({
    timestamp: message.timestamp || new Date().toISOString(),
    lux: toNumberOrNull(data.lux),
    temp_c: toNumberOrNull(data.temp_c ?? data.temperature_c ?? data.temperature),
    humidity: toNumberOrNull(data.humidity ?? data.humidity_pct ?? data.hum_pct),
    motion,
    motion_detected: motion,
    light_level: toNumberOrNull(data.light_level ?? data.light_level_pct ?? data.light_pct),
    health: message.health || data.health || null,
  });

  return Object.keys(row).length > 2 ? row : null;
}

function mergeTelemetryRows(...groups) {
  const seen = new Set();
  const rows = groups
    .flatMap((group) => normalizeTelemetryRows(group))
    .filter((row) => {
      if (!row?.timestamp) return false;
      const key = `${row.timestamp}:${row.lux ?? ""}:${row.temp_c ?? ""}:${row.humidity ?? ""}:${row.light_level ?? ""}:${row.motion ?? ""}:${row.health ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

  return rows.slice(-LIVE_MAX_ROWS_PER_POLE);
}

function filterRowsForRange(rows, from, to) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return rows;

  return rows.filter((row) => {
    const time = new Date(row?.timestamp).getTime();
    return Number.isFinite(time) && time >= fromMs && time <= toMs;
  });
}

function buildLiveReportTelemetry(reportPoles, telemetryByPole, liveTelemetryByPole, from, to) {
  return reportPoles.reduce((nextTelemetry, pole) => {
    const poleId = pole?.streetlight_id;
    if (!poleId) return nextTelemetry;

    const snapshotRow = liveRowFromPole(pole);
    const rows = filterRowsForRange(
      mergeTelemetryRows(
        telemetryByPole[poleId],
        liveTelemetryByPole[poleId] || [],
        snapshotRow ? [snapshotRow] : []
      ),
      from,
      to
    );

    nextTelemetry[poleId] = { streetlight_id: poleId, data: rows };
    return nextTelemetry;
  }, {});
}

function persistRange(nextState) {
  try {
    window.localStorage.setItem(RANGE_STORAGE_KEY, JSON.stringify(nextState));
  } catch {}
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatPoleCount(count) {
  const value = Number(count || 0);
  return `${formatNumber(value)} streetlight${value === 1 ? "" : "s"}`;
}

function formatEnergy(value) {
  if (value === null || value === undefined) return "--";

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "--";

  const absValue = Math.abs(numericValue);
  const maximumFractionDigits =
    absValue >= 100 ? 0 : absValue >= 1 ? 1 : absValue >= 0.01 ? 4 : 6;

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(numericValue)} kWh`;
}

function formatEnergyAxisValue(value, maxValue) {
  const numericValue = Number(value);
  const max = Math.abs(Number(maxValue));
  if (!Number.isFinite(numericValue)) return "--";

  const maximumFractionDigits =
    max >= 100 ? 0 : max >= 10 ? 1 : max >= 1 ? 2 : max >= 0.01 ? 4 : 6;

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
  }).format(numericValue);
}

function formatPercent(value) {
  if (value === null || value === undefined) return "--";

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: Number(value) >= 100 ? 0 : 1,
  }).format(Number(value))}%`;
}

function formatMetricValue(metricId, value, compact = false) {
  if (value === null || value === undefined) return "--";

  const numericValue = Number(value);

  if (metricId === "motion") {
    const digits = Number.isInteger(numericValue) ? 0 : 1;
    const count = new Intl.NumberFormat(undefined, {
      maximumFractionDigits: digits,
    }).format(numericValue);

    return compact
      ? count
      : `${count} detection${numericValue === 1 ? "" : "s"}`;
  }

  const digits = compact ? (numericValue >= 100 ? 0 : 1) : 1;
  const number = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
  }).format(numericValue);

  if (metricId === "light_level" || metricId === "humidity") {
    return `${number}%`;
  }

  if (metricId === "temp_c") {
    return `${number} C`;
  }

  if (metricId === "lux") {
    return `${number} lx`;
  }

  return number;
}

function buildLinearTicks(maxValue, toY, count = 5) {
  return Array.from({ length: count }, (_, index) => {
    const value = (maxValue / Math.max(count - 1, 1)) * index;
    return {
      value,
      y: toY(value),
    };
  });
}

function getNiceCountStep(maxValue, targetSteps = 4) {
  const roughStep = Math.max(1, Math.ceil(maxValue / targetSteps));
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / power;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return multiplier * power;
}

function getNiceCountScale(maxValue) {
  const rawTopValue = Math.max(1, Math.ceil(Number(maxValue) || 1));
  const step = rawTopValue <= MAX_UNIT_COUNT_TICK ? 1 : getNiceCountStep(rawTopValue);
  const topValue = Math.ceil(rawTopValue / step) * step;

  return { step, topValue };
}

function buildCountTicks(maxValue, toY) {
  const { step, topValue } = getNiceCountScale(maxValue);
  const values = [];

  for (let value = 0; value <= topValue; value += step) {
    values.push(value);
  }

  return values.map((value) => ({
    value,
    y: toY(value),
  }));
}

function compareValues(left, right, direction = "desc") {
  const factor = direction === "asc" ? 1 : -1;

  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * factor;
  }

  return String(left || "").localeCompare(String(right || "")) * factor;
}

function formatChartLabel(timestamp, condensed = false, live = false) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return String(timestamp);

  if (live) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return date.toLocaleString(
    undefined,
    condensed
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", hour: "numeric" }
  );
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPrintableTable(headers, rows) {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function openPrintableReport(title, subtitle, sections) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
  if (!popup) return;

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            color: #0f172a;
            margin: 32px;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
          }
          h2 {
            margin: 28px 0 12px;
            font-size: 18px;
          }
          p {
            margin: 0 0 12px;
            color: #475569;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
          .metric {
            border: 1px solid #d7e3ee;
            border-radius: 14px;
            padding: 14px;
            background: #f8fbff;
          }
          .metric strong {
            display: block;
            margin-top: 6px;
            font-size: 22px;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th,
          td {
            border: 1px solid #dbe5ef;
            padding: 8px 10px;
            text-align: left;
          }
          th {
            background: #eef6fb;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        ${sections.join("")}
      </body>
    </html>
  `);
  popup.document.close();

  window.setTimeout(() => {
    popup.focus();
    popup.print();
  }, 300);
}

function buildFullReportSections(report, rangeLabel) {
  const zoneRows = (report?.zones || []).map((zone) => [
    zone.zone,
    String(zone.poleCount),
    formatEnergy(zone.energySavedKwh),
    formatPercent(zone.uptimePct),
    String(zone.faultsResolved),
    String(zone.activeFaults),
  ]);

  const faultRows = (report?.faults || []).slice(0, 20).map((fault) => [
    formatTableTimestamp(fault.timestamp, "--"),
    fault.type,
    fault.poleName || fault.poleId,
    fault.zone,
    fault.status,
    fault.recurring ? "Recurring" : "Single",
  ]);

  return [
    `
      <section>
        <div class="metrics">
          <div class="metric">
            Energy Saved
            <strong>${escapeHtml(formatEnergy(report?.headline?.energySavedKwh))}</strong>
          </div>
          <div class="metric">
            Uptime
            <strong>${escapeHtml(formatPercent(report?.headline?.uptimePct))}</strong>
          </div>
          <div class="metric">
            Faults Resolved
            <strong>${escapeHtml(formatNumber(report?.headline?.faultsResolved))}</strong>
          </div>
        </div>
        <p style="margin-top: 14px;">Range: ${escapeHtml(rangeLabel)}</p>
      </section>
    `,
    `
      <section>
        <h2>Zone Breakdown</h2>
        ${buildPrintableTable(
          ["Zone", "Streetlights", "Energy Saved", "Uptime", "Resolved", "Open"],
          zoneRows
        )}
      </section>
    `,
    `
      <section>
        <h2>Fault History</h2>
        ${buildPrintableTable(
          ["Timestamp", "Fault", "Streetlight", "Zone", "Status", "Pattern"],
          faultRows.length ? faultRows : [["No fault activity in this range", "", "", "", "", ""]]
        )}
      </section>
    `,
  ];
}

function buildEnergySummarySections(report, rangeLabel) {
  const energyRows = (report?.energySeries || []).slice(-16).map((point) => [
    formatTableTimestamp(point.timestamp, "--"),
    formatEnergy(point.actualKwh),
    formatEnergy(point.baselineKwh),
    formatEnergy(point.savedKwh),
  ]);

  const zoneRows = (report?.zones || []).slice(0, 10).map((zone) => [
    zone.zone,
    formatEnergy(zone.actualEnergyKwh),
    formatEnergy(zone.baselineEnergyKwh),
    formatEnergy(zone.energySavedKwh),
  ]);

  return [
    `
      <section>
        <div class="metrics">
          <div class="metric">
            Energy Saved
            <strong>${escapeHtml(formatEnergy(report?.headline?.energySavedKwh))}</strong>
          </div>
          <div class="metric">
            Uptime
            <strong>${escapeHtml(formatPercent(report?.headline?.uptimePct))}</strong>
          </div>
          <div class="metric">
            Active Faults
            <strong>${escapeHtml(formatNumber(report?.headline?.activeFaults))}</strong>
          </div>
        </div>
        <p style="margin-top: 14px;">Range: ${escapeHtml(rangeLabel)}</p>
      </section>
    `,
    `
      <section>
        <h2>Energy Trend Samples</h2>
        ${buildPrintableTable(
          ["Timestamp", "Actual", "Baseline", "Saved"],
          energyRows.length ? energyRows : [["No energy samples available", "", "", ""]]
        )}
      </section>
    `,
    `
      <section>
        <h2>Energy by Zone</h2>
        ${buildPrintableTable(
          ["Zone", "Actual", "Baseline", "Saved"],
          zoneRows.length ? zoneRows : [["No zone data available", "", "", ""]]
        )}
      </section>
    `,
  ];
}

function SkeletonBlock({ className = "", style }) {
  return <div className={`analyticsSkeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

function EmptyState({ title, description }) {
  return (
    <div className="analyticsEmptyState">
      <div className="analyticsEmptyTitle">{title}</div>
      <div className="analyticsEmptyCopy">{description}</div>
    </div>
  );
}

function SectionHeading({ title, description, actions }) {
  return (
    <div className="analyticsSectionHeading">
      <div>
        <div className="analyticsSectionTitle">{title}</div>
        {description ? <div className="analyticsSectionCopy">{description}</div> : null}
      </div>
      {actions ? <div className="analyticsSectionActions">{actions}</div> : null}
    </div>
  );
}

function DateTimeField({ label, value, onChange }) {
  const inputRef = useRef(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
  }

  return (
    <label className="analyticsField">
      <span>{label}</span>
      <div className="analyticsDateField">
        <input
          ref={inputRef}
          type="datetime-local"
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="analyticsDateTrigger"
          onClick={openPicker}
          aria-label={`Open ${label.toLowerCase()} date and time`}
        >
          <UiIcon name="calendar" size={18} />
        </button>
      </div>
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="analyticsField analyticsSelectField">
      <span>{label}</span>
      <select value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ icon, label, value, note, loading }) {
  return (
    <article className="analyticsMetricCard">
      <div className="analyticsMetricIcon">
        <UiIcon name={icon} size={20} />
      </div>
      <div className="analyticsMetricLabel">{label}</div>
      {loading ? (
        <>
          <SkeletonBlock className="analyticsMetricSkeleton" />
          <SkeletonBlock className="analyticsMetricSkeleton analyticsMetricSkeletonSub" />
        </>
      ) : (
        <>
          <div className="analyticsMetricValue">{value}</div>
          <div className="analyticsMetricNote">{note}</div>
        </>
      )}
    </article>
  );
}

function AnalyticsPoleList({ poles, selectedId, onSelect, compact = false }) {
  const selectedPole =
    poles.find((pole) => pole.streetlight_id === selectedId) || poles[0] || null;
  const selectedHealth = selectedPole?.health || "Waiting";

  return (
    <section className={`analyticsPoleListCard${compact ? " isCompact" : ""}`}>
      {!compact ? (
        <SectionHeading
          title="Streetlight List"
          description="Analytics is scoped to the selected reporting streetlight."
        />
      ) : null}

      <label className="analyticsPoleSelectField">
        <span className="analyticsPoleSelectEyebrow">Reporting streetlight</span>
        <div className="analyticsPolePicker">
          <select
            className="analyticsPoleNativeSelect"
            value={selectedId}
            onChange={(event) => onSelect(event.target.value)}
            aria-label="Reporting streetlight"
          >
            {poles.map((pole) => (
              <option key={pole.streetlight_id} value={pole.streetlight_id}>
                {pole.streetlight_id} - {pole.name || "Unnamed streetlight"}
              </option>
            ))}
          </select>

          <span className="analyticsPolePickerIcon" aria-hidden="true">
            <UiIcon name="pin" size={18} />
          </span>
          <span className="analyticsPolePickerCopy" aria-hidden="true">
            <strong>{selectedPole?.streetlight_id || "Select streetlight"}</strong>
            <small>{selectedPole?.name || "Unnamed streetlight"}</small>
          </span>
          {selectedPole ? (
            <span
              className={`analyticsPolePickerHealth ${toneForHealth(selectedHealth)}`}
              aria-hidden="true"
            >
              {selectedHealth}
            </span>
          ) : null}
          <span className="analyticsPolePickerChevron" aria-hidden="true" />
        </div>
      </label>
    </section>
  );
}

function TrendChart({ metricId, energySeries, metricSeries, loading, isLive = false }) {
  const meta = CHART_METRICS[metricId] || CHART_METRICS.energy;
  const width = 1180;
  const height = 360;
  const leftPad = metricId === "motion" ? 72 : 56;
  const rightPad = 22;
  const topPad = 18;
  const bottomPad = 56;

  if (loading) {
    return <SkeletonBlock className="analyticsVizSkeleton analyticsVizSkeletonTall" />;
  }

  if (metricId === "energy") {
    const series = energySeries;
    const latestPoint = series[series.length - 1] || null;

    if (!series.length) {
      return (
        <EmptyState
          title="No energy series available"
          description="No returned telemetry rows are available for this selected streetlight and range."
        />
      );
    }

    const chartLeft = leftPad;
    const chartRight = width - rightPad;
    const chartTop = topPad;
    const chartBottom = height - bottomPad;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;
    const seriesMax = Math.max(
      ...series.flatMap((point) => [point.actualKwh, point.baselineKwh]).map(Number)
    );
    const maxValue =
      Number.isFinite(seriesMax) && seriesMax > 0
        ? seriesMax * 1.18
        : isLive
        ? 0.0005
        : 0.1;

    const toX = (index) =>
      chartLeft + (index / Math.max(series.length - 1, 1)) * chartWidth;

    const toY = (value) => chartBottom - (value / maxValue) * chartHeight;

    const makePath = (key) =>
      series
        .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point[key])}`)
        .join(" ");

    const actualPath = makePath("actualKwh");
    const baselinePath = makePath("baselineKwh");
    const actualArea = `${actualPath} L ${chartRight} ${chartBottom} L ${chartLeft} ${chartBottom} Z`;

    const yTicks = buildLinearTicks(maxValue, toY);

    const xTicks = Array.from(
      new Set([
        0,
        Math.floor((series.length - 1) * 0.25),
        Math.floor((series.length - 1) * 0.5),
        Math.floor((series.length - 1) * 0.75),
        series.length - 1,
      ])
    );

    return (
      <div className="analyticsVizWrap">
        <div className="analyticsVizLegend">
          <span className="analyticsLegendItem">
            <span className="analyticsLegendSwatch isActual" />
            Actual consumption
          </span>
          <span className="analyticsLegendItem">
            <span className="analyticsLegendSwatch isBaseline" />
            Baseline
          </span>
          {isLive && latestPoint ? (
            <span className="analyticsLiveReadout">
              Live actual {formatEnergy(latestPoint.actualKwh)}
            </span>
          ) : null}
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="analyticsViz">
          {yTicks.map((tick) => (
            <g key={`y-${tick.value}`}>
              <line
                x1={chartLeft}
                x2={chartRight}
                y1={tick.y}
                y2={tick.y}
                className="analyticsVizGrid"
              />
              <text
                x={chartLeft - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="analyticsVizAxis"
              >
                {formatEnergyAxisValue(tick.value, maxValue)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={toX(tick)}
                x2={toX(tick)}
                y1={chartTop}
                y2={chartBottom}
                className="analyticsVizGrid analyticsVizGridSubtle"
              />
              <text
                x={toX(tick)}
                y={chartBottom + 22}
                textAnchor="middle"
                className="analyticsVizAxis"
              >
                {formatChartLabel(series[tick]?.timestamp, series.length > 45, isLive)}
              </text>
            </g>
          ))}

          <path d={actualArea} className="analyticsEnergyArea" />
          <path d={baselinePath} className="analyticsEnergyLine isBaseline" />
          <path d={actualPath} className="analyticsEnergyLine isActual" />

          {series.map((point, index) => (
            <g key={`pt-${point.timestamp}-${index}`}>
              <circle
                cx={toX(index)}
                cy={toY(point.actualKwh)}
                r="3.4"
                className="analyticsEnergyDot"
              />
              <title>{`${formatTableTimestamp(point.timestamp)} | Actual ${formatEnergy(
                point.actualKwh
              )} | Baseline ${formatEnergy(point.baselineKwh)}`}</title>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  const series = metricSeries?.[metricId] || [];
  const latestPoint = series[series.length - 1] || null;

  if (!series.length) {
    return (
      <EmptyState
        title={`No ${meta.label.toLowerCase()} series available`}
        description="No returned telemetry rows include this variable for the selected streetlight and range."
      />
    );
  }

  const chartLeft = leftPad;
  const chartRight = width - rightPad;
  const chartTop = topPad;
  const chartBottom = height - bottomPad;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const seriesMaxValue = Math.max(...series.map((point) => Number(point.value || 0)));
  const maxValue =
    metricId === "motion"
      ? getNiceCountScale(Math.max(4, Math.ceil(seriesMaxValue))).topValue
      : Math.max(
          metricId === "light_level" || metricId === "humidity" ? 100 : 1,
          seriesMaxValue
        );

  const toX = (index) =>
    chartLeft + (index / Math.max(series.length - 1, 1)) * chartWidth;

  const toY = (value) => chartBottom - (value / maxValue) * chartHeight;

  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.value)}`)
    .join(" ");
  const areaPath = `${linePath} L ${chartRight} ${chartBottom} L ${chartLeft} ${chartBottom} Z`;

  const yTicks =
    metricId === "motion"
      ? buildCountTicks(maxValue, toY)
      : buildLinearTicks(maxValue, toY);

  const xTicks = Array.from(
    new Set([
      0,
      Math.floor((series.length - 1) * 0.25),
      Math.floor((series.length - 1) * 0.5),
      Math.floor((series.length - 1) * 0.75),
      series.length - 1,
    ])
  );

  const strokeColor =
    metricId === "light_level"
      ? "#0d73a8"
      : metricId === "lux"
      ? "#f0b43a"
      : metricId === "temp_c"
      ? "#ef5b52"
      : metricId === "humidity"
      ? "#14b8a6"
      : "#5b7fff";

  const fillColor =
    metricId === "light_level"
      ? "rgba(13, 115, 168, 0.16)"
      : metricId === "lux"
      ? "rgba(240, 180, 58, 0.18)"
      : metricId === "temp_c"
      ? "rgba(239, 91, 82, 0.18)"
      : metricId === "humidity"
      ? "rgba(20, 184, 166, 0.18)"
      : "rgba(91, 127, 255, 0.16)";

  return (
    <div className="analyticsVizWrap">
      <div className="analyticsVizLegend">
        <span className="analyticsLegendItem">
          <span
            className="analyticsLegendSwatch"
            style={{ background: `linear-gradient(135deg, ${strokeColor}, ${strokeColor})` }}
          />
          {meta.label}
        </span>
        {isLive && latestPoint ? (
          <span className="analyticsLiveReadout">
            Live {formatMetricValue(metricId, latestPoint.value)}
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="analyticsViz">
        {yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              x1={chartLeft}
              x2={chartRight}
              y1={tick.y}
              y2={tick.y}
              className="analyticsVizGrid"
            />
            <text
              x={chartLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              className="analyticsVizAxis"
            >
              {formatMetricValue(metricId, tick.value, true)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={toX(tick)}
              x2={toX(tick)}
              y1={chartTop}
              y2={chartBottom}
              className="analyticsVizGrid analyticsVizGridSubtle"
            />
            <text
              x={toX(tick)}
              y={chartBottom + 22}
              textAnchor="middle"
              className="analyticsVizAxis"
            >
              {formatChartLabel(series[tick]?.timestamp, series.length > 45, isLive)}
            </text>
          </g>
        ))}

        <path
          d={areaPath}
          className="analyticsTrendArea"
          style={{ "--analytics-trend-fill": fillColor }}
        />
        <path
          d={linePath}
          className="analyticsTrendLine"
          style={{ "--analytics-trend-stroke": strokeColor }}
        />

        {series.map((point, index) => (
          <g key={`pt-${point.timestamp}-${index}`}>
            <circle
              cx={toX(index)}
              cy={toY(point.value)}
              r="3.4"
              className="analyticsTrendDot"
              style={{ "--analytics-trend-stroke": strokeColor }}
            />
            <title>{`${formatTableTimestamp(point.timestamp)} | ${meta.label} ${formatMetricValue(
              metricId,
              point.value
            )}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnalyticsSurface() {
  const { streetlights, lastMessage, wsStatus, env } = useLightWise();
  const storedRange = useMemo(() => readStoredRange(), []);
  const {
    availablePoles,
    setSelectedId: setOverviewSelectedId,
  } = useOverviewData({
    streetlights,
    tenantId: env?.TENANT_ID,
  });

  useWebSocketSync(lastMessage);

  const analyticsPoles = useMemo(
    () => getOverviewPoleList(availablePoles),
    [availablePoles]
  );

  const [preset, setPreset] = useState(storedRange.preset);
  const [from, setFrom] = useState(storedRange.from);
  const [to, setTo] = useState(storedRange.to);
  const [aggregation, setAggregation] = useState(storedRange.aggregation || "auto");
  const [selectedPoleId, setSelectedPoleId] = useState("");
  const [telemetryByPole, setTelemetryByPole] = useState({});
  const [liveTelemetryByPole, setLiveTelemetryByPole] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [failedPoles, setFailedPoles] = useState([]);
  const [lastLoadedAt, setLastLoadedAt] = useState("");
  const [zoneSort, setZoneSort] = useState({
    key: "energySavedKwh",
    direction: "desc",
  });
  const [selectedChartMetric, setSelectedChartMetric] = useState("energy");
  const [expandedZones, setExpandedZones] = useState([]);
  const [faultFilter, setFaultFilter] = useState("all");
  const [faultSearch, setFaultSearch] = useState("");
  const [liveNowMs, setLiveNowMs] = useState(() => Date.now());

  const deferredFaultSearch = useDeferredValue(faultSearch);
  const isLiveRange = preset === "live";
  const interval = useMemo(
    () => {
      if (isLiveRange) return LIVE_REQUEST_INTERVAL;
      return aggregation === "auto"
        ? inferTelemetryInterval(from, to)
        : resolveTelemetryInterval(aggregation, from, to);
    },
    [aggregation, from, isLiveRange, to]
  );
  const graphInterval = isLiveRange ? LIVE_GRAPH_INTERVAL : interval;
  const intervalLabel = isLiveRange ? "Instant" : interval;
  const aggregationOptions = isLiveRange ? LIVE_AGGREGATION_OPTIONS : AGGREGATION_OPTIONS;
  const aggregationValue = isLiveRange ? "auto" : aggregation;
  const liveWindow = useMemo(
    () => ({
      from: new Date(liveNowMs - LIVE_WINDOW_MS).toISOString(),
      to: new Date(liveNowMs).toISOString(),
    }),
    [liveNowMs]
  );
  const reportFrom = isLiveRange ? liveWindow.from : from;
  const reportTo = isLiveRange ? liveWindow.to : to;
  const rangeLabel = useMemo(
    () => (isLiveRange ? "Live telemetry" : buildReportDateLabel(from, to)),
    [from, isLiveRange, to]
  );
  const selectedChartMeta = CHART_METRICS[selectedChartMetric] || CHART_METRICS.energy;
  const selectedPole = useMemo(() => {
    return (
      analyticsPoles.find((pole) => pole.streetlight_id === selectedPoleId) ||
      analyticsPoles[0] ||
      null
    );
  }, [analyticsPoles, selectedPoleId]);
  const selectedReportPoleId = selectedPole?.streetlight_id || "";
  const reportPoles = useMemo(
    () => (selectedPole ? [selectedPole] : []),
    [selectedPole]
  );

  const rangeError = useMemo(() => {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return "Choose a valid start and end date to load analytics.";
    }

    if (toMs <= fromMs) {
      return "The end date must be later than the start date.";
    }

    return "";
  }, [from, to]);

  useEffect(() => {
    persistRange({ preset, from, to, aggregation });
  }, [aggregation, preset, from, to]);

  useEffect(() => {
    if (selectedReportPoleId) {
      setOverviewSelectedId(selectedReportPoleId);
    }
  }, [selectedReportPoleId, setOverviewSelectedId]);

  useEffect(() => {
    if (!isLiveRange) return undefined;

    setLiveNowMs(Date.now());
    const timer = window.setInterval(() => setLiveNowMs(Date.now()), LIVE_WINDOW_TICK_MS);
    return () => window.clearInterval(timer);
  }, [isLiveRange]);

  useEffect(() => {
    if (!isLiveRange) return undefined;

    function syncLiveRange() {
      const nextRange = getPresetRange("live");
      setFrom(nextRange.from);
      setTo(nextRange.to);
    }

    syncLiveRange();
    const timer = window.setInterval(syncLiveRange, LIVE_RANGE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isLiveRange]);

  useEffect(() => {
    const poleId = String(lastMessage?.streetlight_id || "").trim();
    if (!poleId) return;

    const row = liveRowFromWsMessage(lastMessage);
    if (!row) return;

    if (isLiveRange) setLiveNowMs(Date.now());

    setLiveTelemetryByPole((current) => ({
      ...current,
      [poleId]: mergeTelemetryRows(current[poleId] || [], [row]),
    }));
    setLastLoadedAt(row.timestamp || new Date().toISOString());
  }, [isLiveRange, lastMessage]);

  useEffect(() => {
    if (!isLiveRange || !selectedPole) return;

    const row = liveRowFromPole(selectedPole);
    if (!row) return;

    setLiveTelemetryByPole((current) => ({
      ...current,
      [selectedPole.streetlight_id]: mergeTelemetryRows(
        current[selectedPole.streetlight_id] || [],
        [row]
      ),
    }));
  }, [isLiveRange, selectedPole]);

  useEffect(() => {
    if (!analyticsPoles.length) {
      if (selectedPoleId) setSelectedPoleId("");
      return;
    }

    if (!analyticsPoles.some((pole) => pole.streetlight_id === selectedPoleId)) {
      setSelectedPoleId(analyticsPoles[0]?.streetlight_id || "");
    }
  }, [analyticsPoles, selectedPoleId]);

  useEffect(() => {
    if (!selectedReportPoleId) {
      setTelemetryByPole({});
      setFailedPoles([]);
      setLoading(false);
      return;
    }

    if (rangeError) {
      setLoadError(rangeError);
      setLoading(false);
      return;
    }

    if (isLiveRange) {
      setTelemetryByPole({});
      setFailedPoles([]);
      setLoadError("");
      setLoading(false);
      return;
    }

    let active = true;

    async function loadNetworkTelemetry() {
      setLoading(true);
      setLoadError("");
      setFailedPoles([]);

      const poles = [selectedReportPoleId];
      const results = await Promise.allSettled(
        poles.map((poleId) =>
          getStreetlightTelemetry(poleId, {
            from,
            to,
            interval,
            allowMockFallback: false,
          })
        )
      );

      if (!active) return;

      const nextTelemetry = {};
      const failures = [];

      results.forEach((result, index) => {
        const poleId = poles[index];

        if (result.status === "fulfilled") {
          nextTelemetry[poleId] = result.value;
          return;
        }

        failures.push(poleId);
      });

      setTelemetryByPole(nextTelemetry);
      setFailedPoles(failures);
      setLoading(false);

      if (failures.length === poles.length) {
        if (isLiveRange) {
          setLoadError("");
          return;
        }

        setLoadError("Analytics data could not be loaded for the selected date range.");
        return;
      }

      setLoadError("");
      setLastLoadedAt(new Date().toISOString());
    }

    loadNetworkTelemetry();

    return () => {
      active = false;
    };
  }, [from, interval, isLiveRange, rangeError, selectedReportPoleId, to]);

  const reportTelemetryByPole = useMemo(() => {
    if (!isLiveRange) return telemetryByPole;
    return buildLiveReportTelemetry(
      reportPoles,
      telemetryByPole,
      liveTelemetryByPole,
      reportFrom,
      reportTo
    );
  }, [
    isLiveRange,
    liveTelemetryByPole,
    reportFrom,
    reportPoles,
    reportTo,
    telemetryByPole,
  ]);

  const report = useMemo(
    () =>
      buildAnalyticsReport(reportPoles, reportTelemetryByPole, {
        from: reportFrom,
        to: reportTo,
        interval: graphInterval,
      }),
    [graphInterval, reportFrom, reportPoles, reportTelemetryByPole, reportTo]
  );
  const hasTelemetryRows = report.summary.telemetryRows > 0;

  useEffect(() => {
    const zoneNames = report.zones.map((zone) => zone.zone);
    setExpandedZones((current) => {
      const next = current.filter((zone) => zoneNames.includes(zone));
      if (next.length) return next;
      return zoneNames[0] ? [zoneNames[0]] : [];
    });
  }, [report.zones]);

  const sortedZones = useMemo(() => {
    const items = [...report.zones];
    const { key, direction } = zoneSort;

    items.sort((left, right) =>
      compareValues(left?.[key], right?.[key], direction)
    );

    return items;
  }, [report.zones, zoneSort]);

  const filteredFaults = useMemo(() => {
    const query = deferredFaultSearch.trim().toLowerCase();

    return report.faults.filter((fault) => {
      if (faultFilter === "active" && fault.status !== "active") return false;
      if (faultFilter === "resolved" && fault.status !== "resolved") return false;
      if (faultFilter === "recurring" && !fault.recurring) return false;

      if (!query) return true;

      const haystack = [
        fault.type,
        fault.poleName,
        fault.poleId,
        fault.zone,
        fault.status,
        fault.health,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deferredFaultSearch, faultFilter, report.faults]);

  const showInitialSkeleton =
    loading && report.rawTelemetryRows.length === 0 && analyticsPoles.length > 0;

  function applyPreset(nextPreset) {
    setPreset(nextPreset);

    if (nextPreset === "custom") return;

    const nextRange = getPresetRange(nextPreset);
    setFrom(nextRange.from);
    setTo(nextRange.to);
  }

  function handleCustomDateChange(field, value) {
    setPreset("custom");
    if (field === "from") setFrom(value);
    if (field === "to") setTo(value);
  }

  function handleZoneSort(key) {
    setZoneSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "desc" ? "asc" : "desc",
        };
      }

      return {
        key,
        direction: key === "zone" ? "asc" : "desc",
      };
    });
  }

  function toggleZone(zoneName) {
    setExpandedZones((current) =>
      current.includes(zoneName)
        ? current.filter((zone) => zone !== zoneName)
        : [...current, zoneName]
    );
  }

  function exportRawCsv() {
    downloadTextFile(
      `lightwise-analytics-raw-${new Date().toISOString().slice(0, 10)}.csv`,
      buildRawTelemetryCsv(report),
      "text/csv;charset=utf-8"
    );
  }

  function exportZoneCsv() {
    downloadTextFile(
      `lightwise-zone-breakdown-${new Date().toISOString().slice(0, 10)}.csv`,
      buildZoneCsv(report),
      "text/csv;charset=utf-8"
    );
  }

  function exportFullPdf() {
    openPrintableReport(
      "LightWise Analytics Report",
      `${rangeLabel} • ${formatPoleCount(report.summary.totalPoles)} • Interval ${intervalLabel}`,
      buildFullReportSections(report, rangeLabel)
    );
  }

  function exportEnergyPdf() {
    openPrintableReport(
      "LightWise Energy Summary",
      `${rangeLabel} • Selected streetlight energy from returned telemetry`,
      buildEnergySummarySections(report, rangeLabel)
    );
  }

  return (
    <div className="analyticsReportPage">
      <header className="analyticsHero">
        <div>
          <div className="analyticsEyebrow">City Reporting Surface</div>
          <h1 className="analyticsHeroTitle">Analytics</h1>
          <p className="analyticsHeroCopy">
            Council-ready reporting for energy performance, reliability, and pedestrian activity.
          </p>
        </div>

        <div className="analyticsHeroMeta">
          <div className="analyticsHeroBadge">
            <UiIcon name="activity" size={16} />
            <span>{rangeLabel}</span>
          </div>
          <div className="analyticsHeroBadge">
            <UiIcon name="radio" size={16} />
            <span>{formatPoleCount(report.summary.totalPoles)}</span>
          </div>
          {isLiveRange ? (
            <div className="analyticsHeroBadge">
              <UiIcon name="activity" size={16} />
              <span>WebSocket {wsStatus || "idle"}</span>
            </div>
          ) : null}
          {lastLoadedAt ? (
            <div className="analyticsHeroBadge">
              <UiIcon name="save" size={16} />
              <span>Refreshed {formatTableTimestamp(lastLoadedAt, "--")}</span>
            </div>
          ) : null}
        </div>
      </header>

      <section className="analyticsStickyBar">
        <div className="analyticsPresetGroup" role="tablist" aria-label="Date range presets">
          {RANGE_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`analyticsPresetButton${preset === option.id ? " isActive" : ""}`}
              onClick={() => applyPreset(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="analyticsStickyControls">
          <div className="analyticsStickyFields">
            <DateTimeField
              label="From"
              value={from}
              onChange={(event) => handleCustomDateChange("from", event.target.value)}
            />
            <DateTimeField
              label="To"
              value={to}
              onChange={(event) => handleCustomDateChange("to", event.target.value)}
            />
            <SelectField
              label="Aggregation"
              value={aggregationValue}
              options={aggregationOptions}
              onChange={(event) => setAggregation(event.target.value)}
            />
            <div className="analyticsRangeMeta">
              <span className="analyticsRangeMetaLabel">Using</span>
              <strong>{intervalLabel}</strong>
            </div>
          </div>

          {analyticsPoles.length ? (
            <AnalyticsPoleList
              compact
              poles={analyticsPoles}
              selectedId={selectedPole?.streetlight_id || ""}
              onSelect={setSelectedPoleId}
            />
          ) : null}
        </div>
      </section>

      {rangeError ? <div className="analyticsBanner isError">{rangeError}</div> : null}
      {!rangeError && loadError ? <div className="analyticsBanner isError">{loadError}</div> : null}
      {!loadError && failedPoles.length ? (
        <div className="analyticsBanner isWarning">
          {failedPoles.length} streetlight{failedPoles.length === 1 ? "" : "s"} could not be included in
          this report: {failedPoles.join(", ")}.
        </div>
      ) : null}

      {!analyticsPoles.length ? (
        <Card>
          <EmptyState
            title="No network inventory is available"
            description="Analytics will populate once streetlights have been provisioned for this tenant."
          />
        </Card>
      ) : (
        <>
          <Card className="analyticsWideCard">
            <SectionHeading
              title={selectedChartMeta.title}
              description={selectedChartMeta.description}
              actions={
                <div className="analyticsMetricSwitchGroup" role="tablist" aria-label="Chart metric">
                  {CHART_METRIC_ORDER.map((metricId) => (
                    <button
                      key={metricId}
                      type="button"
                      className={`analyticsMetricSwitch${
                        selectedChartMetric === metricId ? " isActive" : ""
                      }`}
                      onClick={() => setSelectedChartMetric(metricId)}
                    >
                      {CHART_METRICS[metricId].label}
                    </button>
                  ))}
                </div>
              }
            />

            <TrendChart
              metricId={selectedChartMetric}
              energySeries={report.energySeries}
              metricSeries={report.metricSeries}
              loading={showInitialSkeleton}
              isLive={isLiveRange}
            />
          </Card>

          <section className="analyticsMetricGrid">
            <MetricCard
              icon="bolt"
              label="Energy Saved"
              value={formatEnergy(report.headline.energySavedKwh)}
              note={
                hasTelemetryRows
                  ? "Calculated from returned telemetry samples for the selected streetlight."
                  : "No live energy telemetry loaded for this range."
              }
              loading={showInitialSkeleton}
            />
            <MetricCard
              icon="radio"
              label="Uptime"
              value={formatPercent(report.headline.uptimePct)}
              note={
                hasTelemetryRows
                  ? "Share of healthy telemetry intervals for the selected streetlight."
                  : "No live health telemetry loaded for this range."
              }
              loading={showInitialSkeleton}
            />
            <MetricCard
              icon="alert"
              label="Faults Resolved"
              value={
                hasTelemetryRows ? formatNumber(report.headline.faultsResolved) : "--"
              }
              note={
                hasTelemetryRows
                  ? `${formatNumber(report.headline.activeFaults)} active issues remain in telemetry.`
                  : "No live fault telemetry loaded for this range."
              }
              loading={showInitialSkeleton}
            />
          </section>

          <div className="analyticsSplitGrid">
            <Card className="analyticsSectionCard">
              <SectionHeading
                title="Zone Breakdown"
                description="Sortable rollup built only from returned telemetry samples."
                actions={
                  <button
                    type="button"
                    className="analyticsActionButton"
                    onClick={exportZoneCsv}
                    disabled={!report.zones.length}
                  >
                    CSV export
                  </button>
                }
              />

              {showInitialSkeleton ? (
                <SkeletonBlock className="analyticsTableSkeleton" />
              ) : !sortedZones.length ? (
                <EmptyState
                  title="No zone totals available"
                  description="Zone totals will appear once live samples are available for this streetlight."
                />
              ) : (
                <div className="analyticsTableWrap">
                  <table className="analyticsTable">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" onClick={() => handleZoneSort("zone")}>
                            Zone {zoneSort.key === "zone" ? (zoneSort.direction === "desc" ? "v" : "^") : ""}
                          </button>
                        </th>
                        <th>
                          <button type="button" onClick={() => handleZoneSort("poleCount")}>
                            Streetlights {zoneSort.key === "poleCount" ? (zoneSort.direction === "desc" ? "v" : "^") : ""}
                          </button>
                        </th>
                        <th>
                          <button type="button" onClick={() => handleZoneSort("energySavedKwh")}>
                            Energy Saved {zoneSort.key === "energySavedKwh" ? (zoneSort.direction === "desc" ? "v" : "^") : ""}
                          </button>
                        </th>
                        <th>
                          <button type="button" onClick={() => handleZoneSort("uptimePct")}>
                            Uptime {zoneSort.key === "uptimePct" ? (zoneSort.direction === "desc" ? "v" : "^") : ""}
                          </button>
                        </th>
                        <th>
                          <button type="button" onClick={() => handleZoneSort("faultsResolved")}>
                            Faults {zoneSort.key === "faultsResolved" ? (zoneSort.direction === "desc" ? "v" : "^") : ""}
                          </button>
                        </th>
                        <th>
                          <button type="button" onClick={() => handleZoneSort("motionRatePct")}>
                            Activity {zoneSort.key === "motionRatePct" ? (zoneSort.direction === "desc" ? "v" : "^") : ""}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedZones.map((zone) => {
                        const expanded = expandedZones.includes(zone.zone);

                        return (
                          <Fragment key={zone.zone}>
                            <tr className={`analyticsZoneRow${expanded ? " isExpanded" : ""}`}>
                              <td>
                                <button
                                  type="button"
                                  className="analyticsExpandButton"
                                  onClick={() => toggleZone(zone.zone)}
                                  aria-expanded={expanded}
                                >
                                  {expanded ? "-" : "+"}
                                </button>
                                <span>{zone.zone}</span>
                              </td>
                              <td>{zone.poleCount}</td>
                              <td>{formatEnergy(zone.energySavedKwh)}</td>
                              <td>{formatPercent(zone.uptimePct)}</td>
                              <td>
                                {zone.faultsResolved} resolved
                                <div className="analyticsCellSubtext">
                                  {zone.activeFaults} active
                                </div>
                              </td>
                              <td>{formatPercent(zone.motionRatePct)}</td>
                            </tr>

                            {expanded
                              ? zone.poles.map((pole) => (
                                  <tr
                                    key={`${zone.zone}-${pole.streetlight_id}`}
                                    className="analyticsZoneDetailRow"
                                  >
                                    <td className="analyticsZoneDetailCell">
                                      <div>{pole.name}</div>
                                      <div className="analyticsCellSubtext">{pole.streetlight_id}</div>
                                    </td>
                                    <td>1</td>
                                    <td>{formatEnergy(pole.energySavedKwh)}</td>
                                    <td>{formatPercent(pole.uptimePct)}</td>
                                    <td>
                                      {pole.faultsResolved} resolved
                                      <div className="analyticsCellSubtext">
                                        {pole.activeFaults} active
                                      </div>
                                    </td>
                                    <td>{formatPercent(pole.motionRatePct)}</td>
                                  </tr>
                                ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="analyticsSectionCard">
              <SectionHeading
                title="Fault History"
                description="Searchable event log built only from returned telemetry health samples."
              />

              <div className="analyticsFaultToolbar">
                <input
                  className="analyticsSearchInput"
                  type="search"
                  value={faultSearch}
                  onChange={(event) => setFaultSearch(event.target.value)}
                  placeholder="Search streetlight, zone, or fault"
                />

                <div className="analyticsFilterPills">
                  {FAULT_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className={`analyticsFilterPill${faultFilter === filter.id ? " isActive" : ""}`}
                      onClick={() => setFaultFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {showInitialSkeleton ? (
                <SkeletonBlock className="analyticsLogSkeleton" />
              ) : !filteredFaults.length ? (
                <EmptyState
                  title="No live fault events"
                  description="No returned telemetry health samples produced a fault event for this streetlight and range."
                />
              ) : (
                <div className="analyticsFaultList" role="list">
                  {filteredFaults.map((fault, index) => (
                    <article
                      key={`${fault.poleId}-${fault.timestamp}-${fault.type}-${index}`}
                      className={`analyticsFaultItem${fault.recurring ? " isRecurring" : ""}`}
                    >
                      <div className="analyticsFaultTopRow">
                        <div>
                          <div className="analyticsFaultTitle">{fault.type}</div>
                          <div className="analyticsFaultMeta">
                            {fault.poleName || fault.poleId} • {fault.zone}
                          </div>
                        </div>

                        <div className="analyticsFaultTags">
                          <span className={`analyticsLogPill is${fault.status === "resolved" ? "Resolved" : "Active"}`}>
                            {fault.status}
                          </span>
                          {fault.recurring ? (
                            <span className="analyticsLogPill isRecurring">Recurring</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="analyticsFaultMetaRow">
                        <span>{formatTableTimestamp(fault.timestamp, "--")}</span>
                        <span>{fault.health}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="analyticsSectionCard">
            <SectionHeading
              title="Export"
              description="Generate report artifacts for presentations, council packets, and analysis handoffs."
            />

            <div className="analyticsExportGrid">
              <button
                type="button"
                className="analyticsExportButton"
                onClick={exportFullPdf}
                disabled={!report.rawTelemetryRows.length}
              >
                <span className="analyticsExportIcon">
                  <UiIcon name="save" size={18} />
                </span>
                <span>
                  <strong>Full PDF report</strong>
                  <small>Print-friendly summary of loaded telemetry metrics.</small>
                </span>
              </button>

              <button
                type="button"
                className="analyticsExportButton"
                onClick={exportRawCsv}
                disabled={!report.rawTelemetryRows.length}
              >
                <span className="analyticsExportIcon">
                  <UiIcon name="analytics" size={18} />
                </span>
                <span>
                  <strong>Raw CSV</strong>
                  <small>All loaded telemetry samples with energy estimates and zone labels.</small>
                </span>
              </button>

              <button
                type="button"
                className="analyticsExportButton"
                onClick={exportEnergyPdf}
                disabled={!report.energySeries.length}
              >
                <span className="analyticsExportIcon">
                  <UiIcon name="bolt" size={18} />
                </span>
                <span>
                  <strong>Energy summary PDF</strong>
                  <small>Compact energy-focused packet built from loaded telemetry.</small>
                </span>
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default function Analytics() {
  return (
    <Layout>
      <AnalyticsSurface />
    </Layout>
  );
}
