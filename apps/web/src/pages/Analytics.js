import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import { listStreetlights, getStreetlightTelemetry } from "../services/api";
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

function TelemetryChart({ data, metric }) {
  const width = 1000;
  const height = 320;
  const padding = 36;

  const points = data
    .map((d, i) => ({
      xIndex: i,
      value: safeNum(d?.[metric]),
      label: d?.timestamp,
    }))
    .filter((p) => p.value !== null);

  if (!points.length) {
    return <div className="analytics-empty">No telemetry data for this range.</div>;
  }

  const minVal = Math.min(...points.map((p) => p.value));
  const maxVal = Math.max(...points.map((p) => p.value));
  const range = maxVal - minVal || 1;

  const toX = (i) =>
    padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2);

  const toY = (value) =>
    height - padding - ((value - minVal) / range) * (height - padding * 2);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.value)}`)
    .join(" ");

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    const value = minVal + ((maxVal - minVal) * i) / yTicks;
    return {
      value,
      y: toY(value),
    };
  });

  return (
    <div className="analytics-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-chart">
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding}
              x2={width - padding}
              y1={t.y}
              y2={t.y}
              className="analytics-grid-line"
            />
            <text x={8} y={t.y + 4} className="analytics-axis-text">
              {roundValue(t.value, 0)}
            </text>
          </g>
        ))}

        <path d={path} className="analytics-line" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(p.value)} r="4" className="analytics-dot" />
            <title>{`${formatTableTimestamp(p.label)} | ${metric}: ${roundValue(
              p.value,
              1
            )}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Analytics() {
  const initialRange = getPresetRange("7d");

  const [poles, setPoles] = useState([]);
  const [selectedPole, setSelectedPole] = useState("");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [interval, setSelectedInterval] = useState("1h");
  const [metric, setMetric] = useState("light_level");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [telemetry, setTelemetry] = useState([]);

  useEffect(() => {
    async function loadPoles() {
      try {
        const res = await listStreetlights();
        const items = Array.isArray(res)
          ? res
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.data)
          ? res.data
          : [];

        setPoles(items);

        if (items.length && !selectedPole) {
          const firstId =
            items[0]?.streetlight_id || items[0]?.id || items[0]?.device_id || "";
          setSelectedPole(firstId);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load streetlights.");
      }
    }

    loadPoles();
  }, [selectedPole]);

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
        setError("Failed to load telemetry.");
      } finally {
        setLoading(false);
      }
    }

    loadTelemetry();
  }, [selectedPole, from, to, interval]);

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
          ? roundValue(latest.light_level, 0)
          : "--",
      avgTemp: avg(validTemp, 1),
      avgHumidity: avg(validHumidity, 1),
      motionCount,
    };
  }, [telemetry]);

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
    <Layout title="Analytics" subtitle="Interactive telemetry trends, filters, and pole insights.">
      <div className="analytics-page">
        <div className="analytics-top">
          <Card title="Telemetry Filters">
            <div className="analytics-filters">
              <div className="analytics-field">
                <label>Pole</label>
                <select value={selectedPole} onChange={(e) => setSelectedPole(e.target.value)}>
                  {poles.map((pole, index) => {
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
                <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
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
          <MiniStat label="Latest Light Level" value={stats.latestLight} sub="Brightness proxy" />
          <MiniStat label="Average Temp" value={stats.avgTemp} sub="°C" />
          <MiniStat label="Average Humidity" value={stats.avgHumidity} sub="%" />
          <MiniStat label="Motion Events" value={stats.motionCount} sub="Count in range" />
        </div>

        <Card title="Telemetry Graph">
          {loading ? (
            <div className="analytics-empty">Loading telemetry...</div>
          ) : error ? (
            <div className="analytics-error">{error}</div>
          ) : (
            <TelemetryChart data={telemetry} metric={metric} />
          )}
        </Card>

        <Card title="Recent Telemetry Samples">
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
                  telemetry.slice(-12).reverse().map((row, index) => (
                    <tr key={`${row.timestamp}-${index}`}>
                      <td>{formatTableTimestamp(row.timestamp)}</td>
                      <td>{row.lux ?? "--"}</td>
                      <td>{row.light_level ?? "--"}</td>
                      <td>{row.temp_c ?? "--"}</td>
                      <td>{row.humidity ?? "--"}</td>
                      <td>{row.motion ? "True" : "False"}</td>
                      <td>{row.health || "OK"}</td>
                    </tr>
                  ))
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