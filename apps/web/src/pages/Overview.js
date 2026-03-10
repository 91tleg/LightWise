import React, { useContext, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed";
import Card from "../components/Card";
import ActivityFeed from "../components/ActivityFeed";
import UiIcon from "../components/UiIcon";
import { LightWiseContext } from "../context/LightWiseProvider";
import { listStreetlights, getStreetlightTelemetry } from "../services/api";
import { loadPoleMetaMap } from "../services/poleStorage";
import { formatTimestamp } from "../utils/formatters";
import "../styles/lightwise.css";
import { getCombinedSensorHealth } from "./overview.helpers";

const CACHE_KEYS = {
  STREETLIGHTS: "lightwise_overview_streetlights_cache_v5",
  SNAPSHOTS: "lightwise_overview_snapshots_cache_v5",
  EVENTS: "lightwise_overview_events_cache_v5",
  SELECTED: "lightwise_overview_selected_v5",
};

const HIDDEN_POLE_IDS = new Set(["LW-00043"]);
const DEFAULT_POLE_ID = "LW-00042";

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

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toBoolOrNull(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Boolean(value);
  return null;
}

function cleanDisplay(value, fallback = "Waiting for data") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function normalizePole(pole, index = 0) {
  const id =
    pole?.streetlight_id ||
    pole?.id ||
    pole?.pole_id ||
    pole?.device_id ||
    pole?.streetlightId ||
    `LW-${String(index + 1).padStart(5, "0")}`;

  return {
    streetlight_id: id,
    name: pole?.name || pole?.label || pole?.display_name || null,
    health: pole?.health || pole?.status || "OK",
    lat:
      pole?.lat ??
      pole?.latitude ??
      pole?.location?.lat ??
      pole?.location?.latitude ??
      null,
    lng:
      pole?.lng ??
      pole?.lon ??
      pole?.longitude ??
      pole?.location?.lng ??
      pole?.location?.lon ??
      pole?.location?.longitude ??
      null,
    motion_detected:
      typeof pole?.motion_detected === "boolean"
        ? pole.motion_detected
        : typeof pole?.motion === "boolean"
        ? pole.motion
        : null,
    light_level:
      typeof pole?.light_level === "number"
        ? pole.light_level
        : typeof pole?.brightness === "number"
        ? pole.brightness
        : null,
    last_seen:
      pole?.last_seen ||
      pole?.timestamp ||
      pole?.updated_at ||
      pole?.lastSeen ||
      null,
    ambient_primary_ok: pole?.ambient_primary_ok ?? null,
    ambient_secondary_ok: pole?.ambient_secondary_ok ?? null,
    th_ok: pole?.th_ok ?? null,
    motion_primary_ok: pole?.motion_primary_ok ?? null,
    motion_secondary_ok: pole?.motion_secondary_ok ?? null,
    temp_c: pole?.temp_c ?? null,
    humidity: pole?.humidity ?? null,
    lux: pole?.lux ?? null,
  };
}

function snapshotFromPoint(point) {
  if (!point || typeof point !== "object") return null;

  const diagnostics = point?.diagnostics || {};
  const data = point?.data || {};

  return {
    timestamp: point?.timestamp || point?.time || point?.ts || null,
    health: point?.health ?? null,
    motion_detected: toBoolOrNull(
      point?.motion ?? point?.motion_detected ?? data?.motion
    ),
    light_level: clampPct(
      point?.light_level ?? data?.light_level ?? point?.brightness
    ),
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
    lux:
      typeof point?.lux === "number"
        ? point.lux
        : typeof data?.lux === "number"
        ? data.lux
        : null,
  };
}

function toneForHealth(value) {
  const v = String(value || "").toUpperCase();
  if (v === "CRITICAL") return "critical";
  if (v === "DEGRADED" || v === "WARNING") return "warning";
  if (v === "OK" || v === "HEALTHY" || v === "CONNECTED") return "healthy";
  return "neutral";
}

function mergeLocalMeta(pole, localMeta) {
  const local = localMeta[pole.streetlight_id] || {};
  return {
    ...pole,
    name: hasOwn(local, "name") ? local.name : pole.name,
    lat: hasOwn(local, "lat") ? local.lat : pole.lat,
    lng: hasOwn(local, "lng") ? local.lng : pole.lng,
  };
}

function isVisiblePole(pole) {
  return pole?.streetlight_id && !HIDDEN_POLE_IDS.has(pole.streetlight_id);
}

function buildFallbackPoles(localMeta) {
  const ids = Object.keys(localMeta || {}).filter((id) => !HIDDEN_POLE_IDS.has(id));

  if (!ids.length) {
    return [
      {
        streetlight_id: DEFAULT_POLE_ID,
        name: "Unnamed pole",
        health: "OK",
        lat: 47.6101,
        lng: -122.2015,
        motion_detected: false,
        light_level: 0,
        last_seen: null,
        ambient_primary_ok: null,
        ambient_secondary_ok: null,
        th_ok: null,
        motion_primary_ok: null,
        motion_secondary_ok: null,
        temp_c: null,
        humidity: null,
        lux: null,
      },
    ];
  }

  return ids.map((id) => ({
    streetlight_id: id,
    name: hasOwn(localMeta[id], "name") ? localMeta[id].name : "Unnamed pole",
    health: "OK",
    lat: hasOwn(localMeta[id], "lat") ? localMeta[id].lat : 47.6101,
    lng: hasOwn(localMeta[id], "lng") ? localMeta[id].lng : -122.2015,
    motion_detected: false,
    light_level: 0,
    last_seen: null,
    ambient_primary_ok: null,
    ambient_secondary_ok: null,
    th_ok: null,
    motion_primary_ok: null,
    motion_secondary_ok: null,
    temp_c: null,
    humidity: null,
    lux: null,
  }));
}

function SummaryCard({ icon, label, value, note, tone = "neutral" }) {
  return (
    <Card className="lwSummaryCard">
      <div className="lwSummaryCardTop">
        <span className={`lwSummaryCardIcon ${tone}`}>
          <UiIcon name={icon} size={18} />
        </span>
        <div className="lwSummaryCardLabel">{label}</div>
      </div>
      <div className="lwSummaryCardValue">{value}</div>
      <div className="lwSummaryCardNote">{note}</div>
    </Card>
  );
}

function MetricRow({ label, value, tone = "neutral" }) {
  return (
    <div className="lwMetricRow">
      <span>{label}</span>
      <span className={`lwMetricBadge ${tone}`}>{value}</span>
    </div>
  );
}

export default function Overview() {
  const { wsStatus, lastMessage, subscribe } = useContext(LightWiseContext);

  const initialLocalMeta = loadPoleMetaMap();

  const [localMeta, setLocalMeta] = useState(initialLocalMeta);
  const [streetlights, setStreetlights] = useState(() =>
    readCache(CACHE_KEYS.STREETLIGHTS, buildFallbackPoles(initialLocalMeta)).filter(
      isVisiblePole
    )
  );
  const [snapshotMap, setSnapshotMap] = useState(() => readCache(CACHE_KEYS.SNAPSHOTS, {}));
  const [events, setEvents] = useState(() => readCache(CACHE_KEYS.EVENTS, []));
  const [selectedId, setSelectedId] = useState(() => {
    const cached = readCache(CACHE_KEYS.SELECTED, DEFAULT_POLE_ID);
    return HIDDEN_POLE_IDS.has(cached) ? DEFAULT_POLE_ID : cached;
  });
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  useEffect(() => {
    writeCache(CACHE_KEYS.STREETLIGHTS, streetlights.filter(isVisiblePole));
  }, [streetlights]);

  useEffect(() => writeCache(CACHE_KEYS.SNAPSHOTS, snapshotMap), [snapshotMap]);
  useEffect(() => writeCache(CACHE_KEYS.EVENTS, events), [events]);
  useEffect(() => writeCache(CACHE_KEYS.SELECTED, selectedId), [selectedId]);

  useEffect(() => {
    const refreshLocal = () => setLocalMeta(loadPoleMetaMap());
    window.addEventListener("focus", refreshLocal);
    return () => window.removeEventListener("focus", refreshLocal);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await listStreetlights();
        const rows = (Array.isArray(raw) ? raw : [])
          .map(normalizePole)
          .filter(isVisiblePole);

        if (cancelled) return;

        const latestLocal = loadPoleMetaMap();
        setLocalMeta(latestLocal);

        if (rows.length) {
          const merged = rows.map((pole) => mergeLocalMeta(pole, latestLocal));
          setStreetlights(merged);

          if (!merged.some((pole) => pole.streetlight_id === selectedId)) {
            setSelectedId(merged[0]?.streetlight_id || DEFAULT_POLE_ID);
          }
        } else {
          const fallback = buildFallbackPoles(latestLocal);
          setStreetlights(fallback);

          if (!fallback.some((pole) => pole.streetlight_id === selectedId)) {
            setSelectedId(fallback[0]?.streetlight_id || DEFAULT_POLE_ID);
          }
        }
      } catch {
        const latestLocal = loadPoleMetaMap();
        const fallback = buildFallbackPoles(latestLocal);

        if (!cancelled) {
          setLocalMeta(latestLocal);
          setStreetlights((prev) => (prev.length ? prev.filter(isVisiblePole) : fallback));

          if (!fallback.some((pole) => pole.streetlight_id === selectedId)) {
            setSelectedId(fallback[0]?.streetlight_id || DEFAULT_POLE_ID);
          }
        }
      }
    }

    load();
    const timer = setInterval(load, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedId]);

  const mergedPoles = useMemo(() => {
    const base = streetlights.length ? streetlights : buildFallbackPoles(localMeta);

    return base
      .filter(isVisiblePole)
      .map((pole) => {
        const withLocal = mergeLocalMeta(pole, localMeta);
        const live = snapshotMap[pole.streetlight_id] || {};

        return {
          ...withLocal,
          health: live?.health ?? withLocal.health,
          motion_detected:
            typeof live?.motion_detected === "boolean"
              ? live.motion_detected
              : withLocal.motion_detected,
          light_level:
            live?.light_level != null ? live.light_level : withLocal.light_level,
          last_seen: live?.timestamp ?? withLocal.last_seen,
          ambient_primary_ok:
            live?.ambient_primary_ok != null
              ? live.ambient_primary_ok
              : withLocal.ambient_primary_ok,
          ambient_secondary_ok:
            live?.ambient_secondary_ok != null
              ? live.ambient_secondary_ok
              : withLocal.ambient_secondary_ok,
          th_ok: live?.th_ok != null ? live.th_ok : withLocal.th_ok,
          motion_primary_ok:
            live?.motion_primary_ok != null
              ? live.motion_primary_ok
              : withLocal.motion_primary_ok,
          motion_secondary_ok:
            live?.motion_secondary_ok != null
              ? live.motion_secondary_ok
              : withLocal.motion_secondary_ok,
          temp_c: live?.temp_c != null ? live.temp_c : withLocal.temp_c,
          humidity: live?.humidity != null ? live.humidity : withLocal.humidity,
          lux: live?.lux != null ? live.lux : withLocal.lux,
        };
      });
  }, [streetlights, localMeta, snapshotMap]);

  const selectedPole = useMemo(() => {
    return (
      mergedPoles.find((pole) => pole.streetlight_id === selectedId) ||
      mergedPoles[0] ||
      null
    );
  }, [mergedPoles, selectedId]);

  useEffect(() => {
    if (wsStatus === "connected" && selectedPole?.streetlight_id) {
      subscribe(selectedPole.streetlight_id);
    }
  }, [wsStatus, selectedPole?.streetlight_id, subscribe]);

  useEffect(() => {
    let cancelled = false;

    async function loadTelemetry() {
      if (!selectedPole?.streetlight_id) return;

      setTelemetryLoading(true);

      const to = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const from = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");

      try {
        const points = await getStreetlightTelemetry(selectedPole.streetlight_id, {
          from,
          to,
          interval: "5m",
        });

        if (cancelled) return;

        const rows = Array.isArray(points)
          ? points
          : Array.isArray(points?.items)
          ? points.items
          : Array.isArray(points?.data)
          ? points.data
          : [];

        if (!rows.length) return;

        const snapshots = rows.map(snapshotFromPoint).filter(Boolean);
        const latest = snapshots[snapshots.length - 1];

        if (latest) {
          setSnapshotMap((prev) => ({
            ...prev,
            [selectedPole.streetlight_id]: {
              ...(prev[selectedPole.streetlight_id] || {}),
              ...latest,
            },
          }));
        }
      } catch {
      } finally {
        if (!cancelled) setTelemetryLoading(false);
      }
    }

    loadTelemetry();
    const timer = setInterval(loadTelemetry, 20000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedPole?.streetlight_id]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== "object") return;

    const poleId = lastMessage.streetlight_id || selectedPole?.streetlight_id;
    if (!poleId || HIDDEN_POLE_IDS.has(poleId)) return;

    const snapshot = snapshotFromPoint(lastMessage);

    if (snapshot) {
      setSnapshotMap((prev) => ({
        ...prev,
        [poleId]: {
          ...(prev[poleId] || {}),
          ...snapshot,
        },
      }));
    }

    const nextEvent = {
      id: `${poleId}-${lastMessage.timestamp || Date.now()}`,
      type: "update",
      label:
        typeof snapshot?.motion_detected === "boolean"
          ? snapshot.motion_detected
            ? "Motion detected"
            : "Motion cleared"
          : "Sensor update",
      streetlightId: poleId,
      timestamp: lastMessage.timestamp || new Date().toISOString(),
      value:
        typeof snapshot?.light_level === "number"
          ? `${snapshot.light_level}%`
          : "Updated",
      note: snapshot?.health ? `Health ${snapshot.health}` : undefined,
    };

    setEvents((prev) => [nextEvent, ...prev].slice(0, 12));
  }, [lastMessage, selectedPole?.streetlight_id]);

  const counts = useMemo(() => {
    const total = mergedPoles.length;
    const healthy = mergedPoles.filter((s) => {
      const v = String(s.health || "").toUpperCase();
      return v === "OK" || v === "HEALTHY";
    }).length;
    const warning = mergedPoles.filter((s) => {
      const v = String(s.health || "").toUpperCase();
      return v === "DEGRADED" || v === "WARNING";
    }).length;
    const critical = mergedPoles.filter(
      (s) => String(s.health || "").toUpperCase() === "CRITICAL"
    ).length;

    const status =
      critical > 0
        ? "Critical"
        : warning > 0
        ? "Warning"
        : total > 0
        ? "Healthy"
        : "Offline";

    return { total, healthy, warning, critical, status };
  }, [mergedPoles]);

  const brightnessAvg = useMemo(() => {
    const values = mergedPoles
      .map((pole) => pole.light_level)
      .filter((v) => Number.isFinite(Number(v)))
      .map(Number);

    if (!values.length) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [mergedPoles]);

  const summaryCards = [
    {
      icon: "shield",
      label: "System Status",
      value: counts.status,
      note: `${counts.total} pole${counts.total === 1 ? "" : "s"} online`,
      tone: toneForHealth(counts.status),
    },
    {
      icon: "alert",
      label: "Faults Detected",
      value: String(counts.warning + counts.critical),
      note:
        counts.warning + counts.critical
          ? "Needs operator attention"
          : "No active faults",
      tone: counts.warning + counts.critical ? "warning" : "healthy",
    },
    {
      icon: "bolt",
      label: "Brightness Level",
      value: `${brightnessAvg}%`,
      note: "Average across available poles",
      tone: "healthy",
    },
    {
      icon: "radio",
      label: "Connection Status",
      value:
        wsStatus === "connected"
          ? "Connected"
          : wsStatus === "connecting"
          ? "Connecting"
          : "Offline",
      note: "Source: Mesh Network",
      tone:
        wsStatus === "connected"
          ? "healthy"
          : wsStatus === "connecting"
          ? "warning"
          : "neutral",
    },
  ];

  const combinedSensorHealth = getCombinedSensorHealth(selectedPole);

  return (
    <Layout title="Overview" subtitle="Clean network summary for operators.">
      <div className="lwOverviewPage">
        <div className="lwSummaryGrid">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div
          className="lwOverviewMainGrid"
          style={{
            gridTemplateColumns: "minmax(340px, 0.85fr) minmax(0, 1.95fr)",
            alignItems: "stretch",
          }}
        >
          <div className="lwOverviewSideStack">
            <Card title="Selected Pole" className="lwOperatorCard">
              {selectedPole ? (
                <>
                  <div className="lwSelectedHeaderCompact">
                    <div>
                      <div className="lwSelectedPoleId">{selectedPole.streetlight_id}</div>
                      <div className="lwSelectedPoleName">
                        {cleanDisplay(selectedPole.name, "Unnamed pole")}
                      </div>
                    </div>
                    <span className={`lwMetricBadge ${toneForHealth(selectedPole.health)}`}>
                      {cleanDisplay(selectedPole.health, "Healthy")}
                    </span>
                  </div>

                  <div
                    className="lwMetricGridCompact"
                    style={{ marginTop: 12, gap: 10 }}
                  >
                    <MetricRow
                      label="Motion"
                      value={
                        typeof selectedPole.motion_detected === "boolean"
                          ? selectedPole.motion_detected
                            ? "Detected"
                            : "Clear"
                          : "Clear"
                      }
                      tone={selectedPole.motion_detected ? "warning" : "healthy"}
                    />
                    <MetricRow
                      label="Brightness"
                      value={
                        selectedPole.light_level != null
                          ? `${selectedPole.light_level}%`
                          : telemetryLoading
                          ? "Loading"
                          : "0%"
                      }
                      tone="healthy"
                    />
                    <MetricRow
                      label="Temperature"
                      value={
                        selectedPole.temp_c != null
                          ? `${selectedPole.temp_c}°C`
                          : "Waiting for data"
                      }
                    />
                    <MetricRow
                      label="Humidity"
                      value={
                        selectedPole.humidity != null
                          ? `${selectedPole.humidity}%`
                          : "Waiting for data"
                      }
                    />
                    <MetricRow
                      label="Lux"
                      value={selectedPole.lux != null ? `${Math.round(selectedPole.lux)}` : "Waiting for data"}
                    />
                    <MetricRow
                      label="Latitude"
                      value={cleanDisplay(selectedPole.lat, "Waiting for coordinate")}
                    />
                    <MetricRow
                      label="Longitude"
                      value={cleanDisplay(selectedPole.lng, "Waiting for coordinate")}
                    />
                    <MetricRow
                      label="Last Seen"
                      value={formatTimestamp(selectedPole.last_seen)}
                    />
                    <MetricRow
                      label="Sensor Health"
                      value={combinedSensorHealth.label}
                      tone={combinedSensorHealth.tone}
                    />
                  </div>
                </>
              ) : (
                <div className="lwTrendEmpty">Waiting for pole selection…</div>
              )}
            </Card>

            <Card title="Pole List" className="lwOperatorCard">
              <div className="lwPoleList">
                {mergedPoles.map((pole) => {
                  const selected = pole.streetlight_id === selectedPole?.streetlight_id;
                  return (
                    <button
                      key={pole.streetlight_id}
                      type="button"
                      className={`lwPoleListItem ${selected ? "isSelected" : ""}`}
                      onClick={() => setSelectedId(pole.streetlight_id)}
                    >
                      <div>
                        <strong>{pole.streetlight_id}</strong>
                        <small>{cleanDisplay(pole.name, "Unnamed pole")}</small>
                      </div>
                      <span className={`lwMetricBadge ${toneForHealth(pole.health)}`}>
                        {cleanDisplay(pole.health, "OK")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card title="Recent Activity" className="lwOperatorCard">
              <ActivityFeed events={events} wsStatus={wsStatus} maxItems={5} />
            </Card>
          </div>

          <Card title="Network Map" className="lwMapCardShell">
            <MapEmbed
              title="LightWise network map"
              height={560}
              fillHeight
              lat={selectedPole?.lat}
              lng={selectedPole?.lng}
              poles={mergedPoles}
              selectedId={selectedPole?.streetlight_id}
              onSelectPole={(pole) => setSelectedId(pole.streetlight_id)}
              showLegend
            />
          </Card>
        </div>
      </div>
    </Layout>
  );
}