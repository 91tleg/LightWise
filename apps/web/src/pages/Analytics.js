import React, { useContext, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import { useLightWise } from "../hooks/useLightWise";
import { getStreetlightTelemetry } from "../services/api";
import {
  formatDateTimeLocal,
  formatTableTimestamp,
  roundValue,
  safeNum,
} from "../utils/formatters";
import { normalizeTelemetryRows } from "./analytics.helpers";
import "../styles/lightwise.css";
import "../styles/analytics.css";

const ALLOWED_INTERVALS = [
  "1m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "6h",
  "12h",
  "1d",
  "7d",
  "30d",
];

function getPresetRange(preset) {
  const now = new Date();
  const from = new Date(now);

  if (preset === "24h") from.setHours(now.getHours() - 24);
  if (preset === "7d") from.setDate(now.getDate() - 7);
  if (preset === "30d") from.setDate(now.getDate() - 30);
  if (preset === "90d") from.setDate(now.getDate() - 90);

  return {
    from: formatDateTimeLocal(from),
    to: formatDateTimeLocal(now),
  };
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="analytics-mini-stat">
      <div className="analytics-mini-label">{label}</div>
      <div className="analytics-mini-value">{value}</div>
      {sub ? <div className="analytics-mini-sub">{sub}</div> : null}
    </div>
  );
}

function getMetricMeta(metric) {
  switch (metric) {
    case "light_level":
      return {
        label: "Light Level",
        unit: "%",
        description: "Brightness output / dimming level",
      };
    case "lux":
      return {
        label: "Lux",
        unit: "lx",
        description: "Ambient light intensity around the pole",
      };
    case "temp_c":
      return {
        label: "Temperature",
        unit: "°C",
        description: "Measured device temperature",
      };
    case "humidity":
      return {
        label: "Humidity",
        unit: "%",
        description: "Measured air moisture level",
      };
    default:
      return {
        label: "Value",
        unit: "",
        description: "Telemetry measurement",
      };
  }
}

function formatXAxisLabel(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TelemetryChart({ data, metric, poleId, from, to, interval }) {
  const width = 1000;
  const height = 360;
  const leftPad = 78;
  const rightPad = 26;
  const topPad = 28;
  const bottomPad = 72;

  const metricMeta = getMetricMeta(metric);

  const points = data
    .map((d, i) => ({
      xIndex: i,
      value: safeNum(d?.[metric]),
      label: d?.timestamp,
      raw: d,
    }))
    .filter((p) => p.value !== null);

  if (!points.length) {
    return (
      <div className="analytics-empty">
        No telemetry data is available for this pole, metric, and time range.
      </div>
    );
  }

  const minVal = Math.min(...points.map((p) => p.value));
  const maxVal = Math.max(...points.map((p) => p.value));
  const range = maxVal - minVal || 1;

  const chartLeft = leftPad;
  const chartRight = width - rightPad;
  const chartTop = topPad;
  const chartBottom = height - bottomPad;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const toX = (i) =>
    chartLeft + (i / Math.max(points.length - 1, 1)) * chartWidth;

  const toY = (value) =>
    chartBottom - ((value - minVal) / range) * chartHeight;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.value)}`)
    .join(" ");

  const yTicksCount = 4;
  const yTicks = Array.from({ length: yTicksCount + 1 }, (_, i) => {
    const value = minVal + ((maxVal - minVal) * i) / yTicksCount;
    return {
      value,
      y: toY(value),
    };
  });

  const xTickIndexes = Array.from(
    new Set([
      0,
      Math.floor((points.length - 1) * 0.25),
      Math.floor((points.length - 1) * 0.5),
      Math.floor((points.length - 1) * 0.75),
      points.length - 1,
    ])
  );

  return (
    <div className="analytics-chart-wrap">
      <div className="analytics-chart-header">
        <div>
          <div className="analytics-chart-title">{metricMeta.label} Trend</div>
          <div className="analytics-chart-subtext">
            Showing <strong>{metricMeta.label}</strong> values for{" "}
            <strong>{poleId || "selected pole"}</strong> from{" "}
            <strong>{formatTableTimestamp(from)}</strong> to{" "}
            <strong>{formatTableTimestamp(to)}</strong>, grouped by{" "}
            <strong>{interval}</strong>.
          </div>
        </div>

        <div className="analytics-graph-guide">
          <div className="analytics-graph-guide-label">GRAPH GUIDE</div>
          <div className="analytics-graph-guide-text">
            <strong>X-axis:</strong> Time
            <br />
            <strong>Y-axis:</strong> {metricMeta.label}
            {metricMeta.unit ? ` (${metricMeta.unit})` : ""}
            <br />
            <strong>Meaning:</strong> {metricMeta.description}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-chart">
        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              x1={chartLeft}
              x2={chartRight}
              y1={t.y}
              y2={t.y}
              className="analytics-grid-line"
            />
            <text
              x={chartLeft - 12}
              y={t.y + 4}
              textAnchor="end"
              className="analytics-axis-text"
            >
              {roundValue(t.value, 1)}
              {metricMeta.unit ? ` ${metricMeta.unit}` : ""}
            </text>
          </g>
        ))}

        {xTickIndexes.map((idx) => (
          <g key={`x-guide-${idx}`}>
            <line
              x1={toX(idx)}
              x2={toX(idx)}
              y1={chartTop}
              y2={chartBottom}
              className="analytics-grid-line"
              style={{ opacity: 0.18 }}
            />
          </g>
        ))}

        <line
          x1={chartLeft}
          x2={chartLeft}
          y1={chartTop}
          y2={chartBottom}
          className="analytics-grid-line"
          style={{ opacity: 0.55 }}
        />

        <line
          x1={chartLeft}
          x2={chartRight}
          y1={chartBottom}
          y2={chartBottom}
          className="analytics-grid-line"
          style={{ opacity: 0.55 }}
        />

        <path d={path} className="analytics-line" />

        {points.map((p, i) => (
          <g key={`dot-${i}`}>
            <circle
              cx={toX(i)}
              cy={toY(p.value)}
              r="4"
              className="analytics-dot"
            />
            <title>{`${formatTableTimestamp(p.label)} | ${metricMeta.label}: ${roundValue(
              p.value,
              1
            )}${metricMeta.unit ? ` ${metricMeta.unit}` : ""}`}</title>
          </g>
        ))}

        {xTickIndexes.map((idx) => (
          <g key={`x-label-${idx}`}>
            <text
              x={toX(idx)}
              y={chartBottom + 22}
              textAnchor="middle"
              className="analytics-axis-text"
            >
              {formatXAxisLabel(points[idx]?.label)}
            </text>
          </g>
        ))}

        <text
          x="18"
          y={chartTop + chartHeight / 2}
          transform={`rotate(-90 18 ${chartTop + chartHeight / 2})`}
          className="analytics-axis-text"
          style={{ fontWeight: 700 }}
        >
          {metricMeta.label}
          {metricMeta.unit ? ` (${metricMeta.unit})` : ""}
        </text>

        <text
          x={chartLeft + chartWidth / 2}
          y={height - 18}
          textAnchor="middle"
          className="analytics-axis-text"
          style={{ fontWeight: 700 }}
        >
          Time
        </text>
      </svg>
    </div>
  );
}

function getHealthClass(health) {
  const value = String(health || "OK").toUpperCase();
  if (value === "OK") return "ok";
  if (value === "WARNING") return "warn";
  return "bad";
}

export default function Analytics() {
  const { streetlights } = useLightWise();

  const initialRange = getPresetRange("7d");

  const [selectedPole, setSelectedPole] = useState("");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [interval, setSelectedInterval] = useState("1h");
  const [metric, setMetric] = useState("light_level");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [telemetry, setTelemetry] = useState([]);

  useEffect(() => {
    if (streetlights.length && !selectedPole) {
      setSelectedPole(streetlights[0]?.streetlight_id || "");
    }

    if (
      selectedPole &&
      streetlights.length &&
      !streetlights.some((pole) => pole?.streetlight_id === selectedPole)
    ) {
      setSelectedPole(streetlights[0]?.streetlight_id || "");
    }
  }, [streetlights, selectedPole]);

  useEffect(() => {
    async function loadTelemetry() {
      if (!selectedPole || !from || !to || !interval) return;

      setLoading(true);
      setError("");

      try {
        const res = await getStreetlightTelemetry(selectedPole, { from, to, interval });
        const rows = normalizeTelemetryRows(res);
        setTelemetry(rows);
      } catch (err) {
        console.error(err);
        setTelemetry([]);
        setError("Failed to load telemetry for the selected time range.");
      } finally {
        setLoading(false);
      }
    }

    loadTelemetry();
  }, [selectedPole, from, to, interval]);

  const metricMeta = useMemo(() => getMetricMeta(metric), [metric]);

  const stats = useMemo(() => {
    if (!telemetry.length) {
      return {
        latestLight: "--",
        avgTemp: "--",
        avgHumidity: "--",
        motionCount: "--",
      };
    }

    const validTemp = telemetry.map((d) => d.temp_c).filter((v) => v !== null);
    const validHumidity = telemetry.map((d) => d.humidity).filter((v) => v !== null);
    const motionCount = telemetry.filter((d) => d.motion).length;
    const latest = telemetry[telemetry.length - 1];

    const avg = (arr, digits = 1) =>
      arr.length
        ? roundValue(arr.reduce((a, b) => a + b, 0) / arr.length, digits)
        : "--";

    return {
      latestLight:
        latest?.light_level !== null && latest?.light_level !== undefined
          ? `${roundValue(latest.light_level, 0)}%`
          : "--",
      avgTemp: validTemp.length ? `${avg(validTemp, 1)} °C` : "--",
      avgHumidity: validHumidity.length ? `${avg(validHumidity, 1)}%` : "--",
      motionCount,
    };
  }, [telemetry]);

  const selectedPoleData = useMemo(() => {
    return (
      streetlights.find((pole) => pole?.streetlight_id === selectedPole) || null
    );
  }, [streetlights, selectedPole]);

  const applyPreset = (preset) => {
    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);

    if (preset === "24h") setSelectedInterval("15m");
    if (preset === "7d") setSelectedInterval("1h");
    if (preset === "30d") setSelectedInterval("6h");
    if (preset === "90d") setSelectedInterval("1d");
  };

  return (
    <Layout
      title="Analytics"
      subtitle="Interactive telemetry trends, filters, and pole insights."
    >
      <div className="analytics-page">
        <div className="analytics-top">
          <Card title="Telemetry Filters & Time Range">
            <div className="analytics-filters">
              <div className="analytics-field">
                <label>Pole</label>
                <select value={selectedPole} onChange={(e) => setSelectedPole(e.target.value)}>
                  {streetlights.map((pole, index) => {
                    const id =
                      pole?.streetlight_id || pole?.id || pole?.device_id || `pole-${index}`;
                    const label = pole?.name || pole?.display_name || id;

                    return (
                      <option key={id} value={id}>
                        {label} ({id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="analytics-field">
                <label>From</label>
                <input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              <div className="analytics-field">
                <label>To</label>
                <input
                  type="datetime-local"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              <div className="analytics-field">
                <label>Interval</label>
                <select value={interval} onChange={(e) => setSelectedInterval(e.target.value)}>
                  {ALLOWED_INTERVALS.map((intv) => (
                    <option key={intv} value={intv}>
                      {intv}
                    </option>
                  ))}
                </select>
              </div>

              <div className="analytics-field">
                <label>Metric</label>
                <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  <option value="light_level">Light Level</option>
                  <option value="lux">Lux</option>
                  <option value="temp_c">Temperature</option>
                  <option value="humidity">Humidity</option>
                </select>
              </div>
            </div>

            <div className="analytics-presets">
              <button type="button" onClick={() => applyPreset("24h")}>
                Last 24h
              </button>
              <button type="button" onClick={() => applyPreset("7d")}>
                Last 7d
              </button>
              <button type="button" onClick={() => applyPreset("30d")}>
                Last 30d
              </button>
              <button type="button" onClick={() => applyPreset("90d")}>
                Last 90d
              </button>
            </div>
          </Card>
        </div>

        <div className="analytics-stats-grid">
          <MiniStat
            label="Latest Light Level"
            value={stats.latestLight}
            sub="Most recent brightness / dimming reading"
          />
          <MiniStat
            label="Average Temp"
            value={stats.avgTemp}
            sub="Average device temperature in selected range"
          />
          <MiniStat
            label="Average Humidity"
            value={stats.avgHumidity}
            sub="Average humidity in selected range"
          />
          <MiniStat
            label="Motion Events"
            value={stats.motionCount}
            sub="Number of motion detections in selected range"
          />
        </div>

        <Card title="Telemetry Trend Graph">
          <div className="analytics-graph-explainer">
            This graph shows how <strong>{metricMeta.label.toLowerCase()}</strong> changes over
            time for <strong>{selectedPoleData?.name || selectedPole || "the selected pole"}</strong>.
            The horizontal axis shows <strong>time</strong>, and the vertical axis shows the{" "}
            <strong>
              {metricMeta.label}
              {metricMeta.unit ? ` (${metricMeta.unit})` : ""}
            </strong>{" "}
            value.
          </div>

          {loading ? (
            <div className="analytics-empty">Loading telemetry...</div>
          ) : error ? (
            <div className="analytics-error">{error}</div>
          ) : (
            <TelemetryChart
              data={telemetry}
              metric={metric}
              poleId={selectedPole}
              from={from}
              to={to}
              interval={interval}
            />
          )}
        </Card>

        <Card title="Recent Telemetry Samples">
          <div className="analytics-table-explainer">
            These are the most recent telemetry readings returned for the current filter
            selection. Each row represents one recorded sample from the selected streetlight.
          </div>

          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Lux</th>
                  <th>Light Level</th>
                  <th>Temp</th>
                  <th>Humidity</th>
                  <th>Motion</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.length ? (
                  telemetry.slice(-12).reverse().map((row, index) => {
                    const motionOn = !!row.motion;
                    const health = String(row.health || "OK").toUpperCase();

                    return (
                      <tr key={`${row.timestamp}-${index}`}>
                        <td>{formatTableTimestamp(row.timestamp)}</td>
                        <td>{row.lux ?? "--"}</td>
                        <td>
                          {row.light_level ?? "--"}
                          {row.light_level !== null && row.light_level !== undefined ? "%" : ""}
                        </td>
                        <td>
                          {row.temp_c ?? "--"}
                          {row.temp_c !== null && row.temp_c !== undefined ? " °C" : ""}
                        </td>
                        <td>
                          {row.humidity ?? "--"}
                          {row.humidity !== null && row.humidity !== undefined ? "%" : ""}
                        </td>
                        <td>
                          <span
                            className={`analytics-pill ${
                              motionOn ? "motion-on" : "motion-off"
                            }`}
                          >
                            {motionOn ? "Detected" : "Clear"}
                          </span>
                        </td>
                        <td>
                          <span className={`analytics-pill ${getHealthClass(health)}`}>
                            {health}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="analytics-no-rows">
                      No telemetry samples available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}