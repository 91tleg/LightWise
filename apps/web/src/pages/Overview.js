import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed";
import Legend from "../components/Legend";
import Panel from "../components/Panel";
import Card from "../components/Card";
import PillRow from "../components/PillRow";

import { listStreetlights, getStreetlightTelemetry } from "../services/api";
import { useLightWiseWS } from "../services/useLightWiseWS";

const CACHE_KEYS = {
  STREETLIGHTS: "lightwise_overview_streetlights_cache_v1",
  SNAPSHOTS: "lightwise_overview_snapshots_cache_v1",
  TRENDS: "lightwise_overview_trends_cache_v1",
};

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function formatTimestamp(ts) {
  if (!ts) return "N/A";
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

function isoNoMs(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (!Number.isFinite(x.getTime())) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  return x.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function MiniLineChart({ values = [], height = 120 }) {
  const w = 520;
  const h = height;

  const pts = useMemo(() => {
    const arr = (values || [])
      .filter((v) => Number.isFinite(Number(v)))
      .map(Number);

    if (arr.length < 2) return "";

    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const span = max - min || 1;

    return arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * (w - 20) + 10;
        const y = h - 10 - ((v - min) / span) * (h - 20);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values, h]);

  if (!pts) {
    return (
      <div className="lwPlaceholder lwOverviewPlaceholder">
        Waiting for telemetry to plot…
      </div>
    );
  }

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.9"
      />
    </svg>
  );
}

function okFail(val) {
  if (val == null) return "N/A";
  return val ? "OK" : "FAIL";
}

function normalizeTelemetryPoints(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.telemetry)) return payload.telemetry;
  if (payload.data && Array.isArray(payload.data.points)) return payload.data.points;
  return [];
}

function getPointLightLevel(p) {
  const direct = p?.light_level;
  if (typeof direct === "number") return direct;

  const nested = p?.data?.light_level;
  if (typeof nested === "number") return nested;

  const directStr = Number(p?.light_level);
  if (Number.isFinite(directStr)) return directStr;

  const nestedStr = Number(p?.data?.light_level);
  if (Number.isFinite(nestedStr)) return nestedStr;

  return null;
}

function getPointMotion(p) {
  const m = p?.motion ?? p?.data?.motion;
  if (typeof m === "boolean") return m;
  if (typeof m === "number") return Boolean(m);
  return null;
}

function toBoolOrNull(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return Boolean(v);
  return null;
}

function extractSnapshotFromPoint(point) {
  if (!point || typeof point !== "object") return null;

  const diagnostics = point?.diagnostics || {};
  const data = point?.data || {};

  return {
    timestamp: point?.timestamp || point?.time || point?.ts || null,
    health: point?.health ?? null,
    motion_detected: getPointMotion(point),
    light_level: getPointLightLevel(point),

    ambient_primary_ok: toBoolOrNull(
      point?.ambient_primary_ok ?? diagnostics?.ambient_primary_ok
    ),
    ambient_secondary_ok: toBoolOrNull(
      point?.ambient_secondary_ok ?? diagnostics?.ambient_secondary_ok
    ),
    th_ok: toBoolOrNull(point?.th_ok ?? diagnostics?.th_ok),
    motion_primary_ok: toBoolOrNull(
      point?.motion_primary_ok ?? diagnostics?.motion_primary_ok
    ),
    motion_secondary_ok: toBoolOrNull(
      point?.motion_secondary_ok ?? diagnostics?.motion_secondary_ok
    ),

    temp_c:
      typeof point?.temp_c === "number"
        ? point.temp_c
        : typeof data?.temp_c === "number"
        ? data.temp_c
        : null,

    humidity:
      typeof point?.humidity === "number"
        ? point.humidity
        : typeof data?.humidity === "number"
        ? data.humidity
        : null,
  };
}

function extractSnapshotFromWsMessage(msg) {
  if (!msg || typeof msg !== "object") return null;

  const diagnostics = msg?.diagnostics || {};
  const data = msg?.data || {};

  return {
    timestamp: msg?.timestamp || null,
    health: msg?.health ?? null,
    motion_detected: getPointMotion(msg),
    light_level: getPointLightLevel(msg),

    ambient_primary_ok: toBoolOrNull(diagnostics?.ambient_primary_ok),
    ambient_secondary_ok: toBoolOrNull(diagnostics?.ambient_secondary_ok),
    th_ok: toBoolOrNull(diagnostics?.th_ok),
    motion_primary_ok: toBoolOrNull(diagnostics?.motion_primary_ok),
    motion_secondary_ok: toBoolOrNull(diagnostics?.motion_secondary_ok),

    temp_c: typeof data?.temp_c === "number" ? data.temp_c : null,
    humidity: typeof data?.humidity === "number" ? data.humidity : null,
  };
}

function statusTone(value) {
  const v = String(value || "").toUpperCase();
  if (v === "OK" || v === "LIVE" || v === "TRUE" || v === "CONNECTED") return "good";
  if (v === "DEGRADED" || v === "WARNING" || v === "RECENT" || v === "CACHED") return "warn";
  if (v === "CRITICAL" || v === "FAIL" || v === "FALSE" || v === "ERROR") return "bad";
  return "neutral";
}

function boolTone(val) {
  if (val == null) return "neutral";
  return val ? "good" : "bad";
}

function FieldRow({ label, value, tone = "neutral" }) {
  return (
    <div className="lwFieldRow">
      <span className="lwFieldLabel">{label}</span>
      <span className={`lwFieldValue lwTone-${tone}`}>{value ?? "N/A"}</span>
    </div>
  );
}

export default function Overview() {
  const WS_URL =
    process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || "";

  const [streetlights, setStreetlights] = useState(() =>
    readCache(CACHE_KEYS.STREETLIGHTS, [])
  );

  const [telemetryLoading, setTelemetryLoading] = useState(false);

  const [snapshotMap, setSnapshotMap] = useState(() =>
    readCache(CACHE_KEYS.SNAPSHOTS, {})
  );
  const [trendMap, setTrendMap] = useState(() =>
    readCache(CACHE_KEYS.TRENDS, {})
  );

  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    debug: false,
  });

  useEffect(() => {
    writeCache(CACHE_KEYS.STREETLIGHTS, streetlights);
  }, [streetlights]);

  useEffect(() => {
    writeCache(CACHE_KEYS.SNAPSHOTS, snapshotMap);
  }, [snapshotMap]);

  useEffect(() => {
    writeCache(CACHE_KEYS.TRENDS, trendMap);
  }, [trendMap]);

  const refreshStreetlights = async () => {
    try {
      const rows = await listStreetlights();
      if (Array.isArray(rows) && rows.length > 0) {
        setStreetlights(rows);
      }
    } catch {}
  };

  useEffect(() => {
    refreshStreetlights();
  }, []);

  const stats = useMemo(() => {
    const total = streetlights.length;

    const ok = streetlights.filter((s) => s.health === "OK").length;
    const degraded = streetlights.filter((s) => s.health === "DEGRADED").length;
    const critical = streetlights.filter((s) => s.health === "CRITICAL").length;

    const alerts = streetlights
      .filter((s) => s.health === "DEGRADED" || s.health === "CRITICAL")
      .slice(0, 5);

    const selected = streetlights[0] || null;

    const systemStatus =
      critical > 0 ? "CRITICAL" : degraded > 0 ? "DEGRADED" : total > 0 ? "OK" : "N/A";

    return { total, ok, degraded, critical, systemStatus, alerts, selected };
  }, [streetlights]);

  const selected = stats.selected;
  const selectedStreetlightId = selected?.streetlight_id || "";

  const lightTrend = useMemo(() => {
    return Array.isArray(trendMap[selectedStreetlightId])
      ? trendMap[selectedStreetlightId]
      : [];
  }, [trendMap, selectedStreetlightId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTelemetryOnce() {
      const to = isoNoMs(new Date());
      const from = isoNoMs(new Date(Date.now() - 60 * 60 * 1000));

      return getStreetlightTelemetry(selectedStreetlightId, {
        from,
        to,
        interval: "5m",
      });
    }

    async function hydrateFromHttp() {
      if (!selectedStreetlightId) return;

      setTelemetryLoading(true);

      try {
        let payload;

        try {
          payload = await fetchTelemetryOnce();
        } catch {
          await new Promise((r) => setTimeout(r, 800));
          payload = await fetchTelemetryOnce();
        }

        if (cancelled) return;

        const points = normalizeTelemetryPoints(payload);

        const values = points
          .map(getPointLightLevel)
          .filter((v) => typeof v === "number" && Number.isFinite(v))
          .map(clampPct);

        if (values.length) {
          setTrendMap((prev) => ({
            ...prev,
            [selectedStreetlightId]: values.slice(-40),
          }));
        }

        const last = points[points.length - 1];
        const snapshot = extractSnapshotFromPoint(last);
        if (snapshot) {
          setSnapshotMap((prev) => ({
            ...prev,
            [selectedStreetlightId]: {
              ...(prev[selectedStreetlightId] || {}),
              ...snapshot,
            },
          }));
        }
      } catch {
      } finally {
        if (!cancelled) setTelemetryLoading(false);
      }
    }

    hydrateFromHttp();

    return () => {
      cancelled = true;
    };
  }, [selectedStreetlightId]);

  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (!selectedStreetlightId) return;
    subscribe(selectedStreetlightId);
  }, [wsStatus, selectedStreetlightId, subscribe]);

  useEffect(() => {
    const msg = lastMessage;
    if (!msg || typeof msg !== "object") return;
    if (msg.streetlight_id !== selectedStreetlightId) return;

    const lvl = msg?.data?.light_level;
    if (typeof lvl === "number") {
      setTrendMap((prev) => {
        const existing = Array.isArray(prev[selectedStreetlightId])
          ? prev[selectedStreetlightId]
          : [];
        return {
          ...prev,
          [selectedStreetlightId]: [...existing, clampPct(lvl)].slice(-40),
        };
      });
    }

    const snapshot = extractSnapshotFromWsMessage(msg);
    if (snapshot) {
      setSnapshotMap((prev) => ({
        ...prev,
        [selectedStreetlightId]: {
          ...(prev[selectedStreetlightId] || {}),
          ...snapshot,
        },
      }));
    }
  }, [lastMessage, selectedStreetlightId]);

  const cachedSnapshot = snapshotMap[selectedStreetlightId] || null;

  const mergedSelected = useMemo(() => {
    if (!selected) return null;

    return {
      ...selected,
      health: cachedSnapshot?.health ?? selected.health,
      motion_detected:
        typeof cachedSnapshot?.motion_detected === "boolean"
          ? cachedSnapshot.motion_detected
          : selected.motion_detected,
      last_seen: cachedSnapshot?.timestamp ?? selected.last_seen,

      ambient_primary_ok:
        cachedSnapshot?.ambient_primary_ok ?? selected.ambient_primary_ok,
      ambient_secondary_ok:
        cachedSnapshot?.ambient_secondary_ok ?? selected.ambient_secondary_ok,
      th_ok: cachedSnapshot?.th_ok ?? selected.th_ok,
      motion_primary_ok:
        cachedSnapshot?.motion_primary_ok ?? selected.motion_primary_ok,
      motion_secondary_ok:
        cachedSnapshot?.motion_secondary_ok ?? selected.motion_secondary_ok,

      temp_c: cachedSnapshot?.temp_c ?? selected.temp_c,
      humidity: cachedSnapshot?.humidity ?? selected.humidity,
    };
  }, [selected, cachedSnapshot]);

  const selectedId = mergedSelected?.streetlight_id ?? "—";

  const selectedMotion = useMemo(() => {
    if (typeof mergedSelected?.motion_detected === "boolean") {
      return mergedSelected.motion_detected ? "true" : "false";
    }
    return "N/A";
  }, [mergedSelected?.motion_detected]);

  const energyTrendState =
    wsStatus === "connected" ? "Live" : lightTrend.length ? "Cached" : "N/A";

  const kpis = [
    {
      icon: stats.systemStatus === "CRITICAL" ? "🟥" : stats.systemStatus === "DEGRADED" ? "🟧" : "✅",
      label: "System Status",
      value: stats.systemStatus,
      note: stats.total ? `${stats.total} poles` : "No data",
      tone: statusTone(stats.systemStatus),
    },
    {
      icon: "⚠️",
      label: "Faults Detected",
      value: String(stats.degraded + stats.critical || "0"),
      note: "DEGRADED + CRITICAL",
      tone: stats.degraded + stats.critical > 0 ? "warn" : "good",
    },
    {
      icon: "♻️",
      label: "Energy Trend",
      value: energyTrendState,
      note: "",
      tone: statusTone(energyTrendState),
    },
    {
      icon: "📡",
      label: "Total Poles",
      value: String(stats.total || "0"),
      note: "",
      tone: stats.total > 0 ? "good" : "neutral",
    },
  ];

  const lat = typeof mergedSelected?.lat === "number" ? mergedSelected.lat : null;
  const lng = typeof mergedSelected?.lng === "number" ? mergedSelected.lng : null;

  return (
    <>
      <style>{`
        .lwKpiGrid .lwCard,
        .lwPanelGrid .lwCard,
        .lwBottomGrid .lwCard,
        .lwPanelGrid .lwPanel,
        .lwBottomGrid .lwPanel,
        .lwKpiGrid > *,
        .lwPanelGrid > *,
        .lwBottomGrid > * {
          overflow: hidden;
        }

        .lwKpiGrid > *,
        .lwPanelGrid > *,
        .lwBottomGrid > * {
          border-radius: 22px !important;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06) !important;
        }

        .lwOverviewPlaceholder {
          min-height: 124px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(248,250,252,0.78), rgba(241,245,249,0.88));
          color: #7b8794 !important;
          font-weight: 800;
          letter-spacing: 0.01em;
          border: 1px dashed rgba(148, 163, 184, 0.28);
        }

        .lwOverviewAlertsList {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
        }

        .lwOverviewAlertItem {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(248, 250, 252, 0.9);
          border: 1px solid rgba(226, 232, 240, 0.9);
        }

        .lwOverviewAlertMain {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .lwOverviewAlertId {
          font-weight: 900;
          color: #1f2937;
          letter-spacing: 0.01em;
          white-space: nowrap;
        }

        .lwOverviewAlertName {
          color: #6b7280;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .lwStatusBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 74px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          border: 1px solid transparent;
        }

        .lwStatusBadge.good {
          background: rgba(34, 197, 94, 0.14);
          color: #15803d;
          border-color: rgba(34, 197, 94, 0.24);
        }

        .lwStatusBadge.warn {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
          border-color: rgba(245, 158, 11, 0.24);
        }

        .lwStatusBadge.bad {
          background: rgba(239, 68, 68, 0.14);
          color: #b91c1c;
          border-color: rgba(239, 68, 68, 0.24);
        }

        .lwStatusBadge.neutral {
          background: rgba(148, 163, 184, 0.14);
          color: #475569;
          border-color: rgba(148, 163, 184, 0.24);
        }

        .lwFieldRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(248, 250, 252, 0.95);
          border: 1px solid rgba(226, 232, 240, 0.9);
        }

        .lwFieldLabel {
          font-weight: 800;
          color: #334155;
          min-width: 0;
        }

        .lwFieldValue {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: right;
          padding: 5px 10px;
          border-radius: 999px;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.01em;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .lwTone-good {
          background: rgba(34, 197, 94, 0.14);
          color: #166534;
          border-color: rgba(34, 197, 94, 0.22);
        }

        .lwTone-warn {
          background: rgba(245, 158, 11, 0.14);
          color: #b45309;
          border-color: rgba(245, 158, 11, 0.22);
        }

        .lwTone-bad {
          background: rgba(239, 68, 68, 0.14);
          color: #b91c1c;
          border-color: rgba(239, 68, 68, 0.22);
        }

        .lwTone-neutral {
          background: rgba(148, 163, 184, 0.14);
          color: #475569;
          border-color: rgba(148, 163, 184, 0.22);
        }

        .lwOverviewKpiWrap {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 14px;
        }

        .lwOverviewKpiIcon {
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(248, 250, 252, 0.9);
          font-size: 24px;
          box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.9);
        }

        .lwOverviewKpiText {
          min-width: 0;
        }

        .lwOverviewKpiLabel {
          color: #475569;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .lwOverviewKpiValue {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lwOverviewKpiNumber {
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .lwOverviewKpiNote {
          color: #6b7280;
          font-size: 14px;
          margin-top: 8px;
          line-height: 1.35;
          min-height: 19px;
        }

        .lwSelectedTopMeta {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: start;
          margin-bottom: 12px;
        }

        .lwSelectedMainTitle {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .lwSelectedId {
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.03em;
        }

        .lwSelectedName {
          color: #64748b;
          font-weight: 800;
          font-size: 15px;
        }

        .lwSelectedGrid {
          display: grid;
          gap: 10px;
        }

        .lwOverviewMapHint {
          margin-top: 10px;
          color: #6b7280;
          font-size: 13px;
          text-align: center;
        }

        .lwOverviewOperationsMeta {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }

        .lwOverviewOperationsMetaRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(248, 250, 252, 0.95);
          border: 1px solid rgba(226, 232, 240, 0.9);
        }

        .lwOverviewOperationsMetaLabel {
          font-weight: 800;
          color: #334155;
        }

        .lwOverviewOperationsMetaValue {
          font-weight: 900;
          color: #0f172a;
        }

        .lwBottomGrid .lwPoleMeta {
          width: 100%;
        }

        @media (max-width: 900px) {
          .lwSelectedTopMeta {
            grid-template-columns: 1fr;
          }

          .lwFieldRow,
          .lwOverviewOperationsMetaRow,
          .lwOverviewAlertItem {
            align-items: flex-start;
            flex-direction: column;
          }

          .lwFieldValue,
          .lwStatusBadge {
            white-space: normal;
          }
        }
      `}</style>

      <Layout title="Overview" subtitle="System health, alerts, and a quick view of the network.">
        <div className="lwKpiGrid">
          {kpis.map(({ icon, label, value, note, tone }) => (
            <div
              key={label}
              style={{
                borderRadius: 22,
                background: "rgba(255,255,255,0.72)",
                padding: 18,
              }}
            >
              <div className="lwOverviewKpiWrap">
                <div className="lwOverviewKpiIcon">{icon}</div>
                <div className="lwOverviewKpiText">
                  <div className="lwOverviewKpiLabel">{label}</div>
                  <div className="lwOverviewKpiValue">
                    <div className="lwOverviewKpiNumber">{value}</div>
                    <span className={`lwStatusBadge ${tone}`}>{value}</span>
                  </div>
                  <div className="lwOverviewKpiNote">{note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lwPanelGrid">
          <Panel title="Recent Alerts">
            {!stats.alerts.length ? (
              <div className="lwPlaceholder lwOverviewPlaceholder">No alerts</div>
            ) : (
              <ul className="lwOverviewAlertsList">
                {stats.alerts.map((s) => (
                  <li key={s.streetlight_id} className="lwOverviewAlertItem">
                    <div className="lwOverviewAlertMain">
                      <span className="lwOverviewAlertId">{s.streetlight_id}</span>
                      <span className="lwOverviewAlertName">{s.name || "Unnamed"}</span>
                    </div>
                    <span className={`lwStatusBadge ${statusTone(s.health)}`}>
                      {s.health || "N/A"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Energy Trend">
            <div style={{ marginTop: 12 }}>
              {telemetryLoading && !lightTrend.length ? (
                <div className="lwPlaceholder lwOverviewPlaceholder">Loading telemetry…</div>
              ) : (
                <MiniLineChart values={lightTrend} height={120} />
              )}
            </div>
          </Panel>

          <Panel title="Operations">
            <PillRow
              pills={[
                { label: `OK: ${stats.ok}`, color: "green" },
                { label: `DEGRADED: ${stats.degraded}`, color: "orange" },
                { label: `CRITICAL: ${stats.critical}`, color: "red" },
              ]}
            />

            <div className="lwOverviewOperationsMeta">
              <div className="lwOverviewOperationsMetaRow">
                <span className="lwOverviewOperationsMetaLabel">Latest pole</span>
                <span className="lwOverviewOperationsMetaValue">{selectedId}</span>
              </div>

              <div className="lwOverviewOperationsMetaRow">
                <span className="lwOverviewOperationsMetaLabel">WS status</span>
                <span className={`lwStatusBadge ${statusTone(wsStatus)}`}>{wsStatus}</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="lwBottomGrid">
          <Card title="Selected Lightpole">
            <div className="lwPoleRow">
              <div className="lwPoleMeta">
                <div className="lwSelectedTopMeta">
                  <div className="lwSelectedMainTitle">
                    <div className="lwSelectedId">{selectedId}</div>
                    <div className="lwSelectedName">{mergedSelected?.name ?? "N/A"}</div>
                  </div>
                  <div>
                    <span className={`lwStatusBadge ${statusTone(mergedSelected?.health)}`}>
                      {mergedSelected?.health ?? "N/A"}
                    </span>
                  </div>
                </div>

                <div className="lwSelectedGrid">
                  <FieldRow label="Latitude" value={mergedSelected?.lat ?? "N/A"} tone="neutral" />
                  <FieldRow label="Longitude" value={mergedSelected?.lng ?? "N/A"} tone="neutral" />
                  <FieldRow
                    label="Motion"
                    value={selectedMotion}
                    tone={statusTone(selectedMotion)}
                  />
                  <FieldRow
                    label="Last seen"
                    value={formatTimestamp(mergedSelected?.last_seen)}
                    tone="neutral"
                  />
                  <FieldRow
                    label="Ambient Primary"
                    value={okFail(mergedSelected?.ambient_primary_ok)}
                    tone={boolTone(mergedSelected?.ambient_primary_ok)}
                  />
                  <FieldRow
                    label="Ambient Secondary"
                    value={okFail(mergedSelected?.ambient_secondary_ok)}
                    tone={boolTone(mergedSelected?.ambient_secondary_ok)}
                  />
                  <FieldRow
                    label="Temp / Humidity"
                    value={okFail(mergedSelected?.th_ok)}
                    tone={boolTone(mergedSelected?.th_ok)}
                  />
                  <FieldRow
                    label="Motion Primary"
                    value={okFail(mergedSelected?.motion_primary_ok)}
                    tone={boolTone(mergedSelected?.motion_primary_ok)}
                  />
                  <FieldRow
                    label="Motion Secondary"
                    value={okFail(mergedSelected?.motion_secondary_ok)}
                    tone={boolTone(mergedSelected?.motion_secondary_ok)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Map">
            <MapEmbed title="Selected pole pin" height={300} lat={lat} lng={lng} zoom={17} />
            <div className="lwOverviewMapHint">Selected pole location preview</div>
          </Card>

          <Legend />
        </div>
      </Layout>
    </>
  );
}