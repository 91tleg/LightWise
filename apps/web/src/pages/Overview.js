import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed.js";
import Card from "../components/Card";
import ActivityFeed from "../components/ActivityFeed";
import SummaryCard from "../components/SummaryCard";
import MetricRow from "../components/MetricRow";
import { useLightWise } from "../hooks/useLightWise";
import { useOverviewData } from "../hooks/useOverviewData";
import { useTelemetryLoader } from "../hooks/useTelemetryLoader";
import { useWebSocketSync } from "../hooks/useWebSocketSync";
import { formatTimestamp } from "../utils/formatters";
import {
  getCombinedSensorHealth,
  getOverviewPoleList,
  isPoleTelemetryStale,
} from "./overview.helpers";
import {
  motionLabel,
  toneForHealth,
} from "../utils/poleState";
import "../styles/lightwise.css";
import "../styles/overview.css";

const OVERVIEW_TELEMETRY_REFRESH_MS = 15000;

function cleanDisplay(value, fallback = "Waiting for data") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function renderMetricValue(value, formatter, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  return formatter ? formatter(value) : value;
}

function hasReading(value) {
  return value !== null && value !== undefined && value !== "";
}

function hasPoleTelemetry(pole) {
  if (!pole) return false;

  return (
    typeof pole.motion_detected === "boolean" ||
    hasReading(pole.light_level) ||
    hasReading(pole.temp_c) ||
    hasReading(pole.humidity) ||
    hasReading(pole.lux) ||
    hasReading(pole.health)
  );
}

export default function Overview() {
  const { wsStatus, lastMessage, streetlights, env } = useLightWise();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mapMode, setMapMode] = useState("all");
  const [mapFitRequestKey, setMapFitRequestKey] = useState(0);
  const {
    availablePoles,
    selectedId,
    selectedPole,
    setSelectedId,
    setSnapshotMap,
    mapPoles,
    mapCenter,
  } = useOverviewData({
    streetlights,
    tenantId: env?.TENANT_ID,
  });

  const overviewPoles = useMemo(
    () => getOverviewPoleList(availablePoles),
    [availablePoles]
  );
  const overviewSelectedPole = useMemo(() => {
    const selectedFromList = overviewPoles.find(
      (pole) => pole.streetlight_id === selectedId
    );
    if (selectedFromList) return selectedFromList;

    if (
      selectedPole &&
      overviewPoles.some((pole) => pole.streetlight_id === selectedPole.streetlight_id)
    ) {
      return selectedPole;
    }

    return overviewPoles[0] || null;
  }, [overviewPoles, selectedId, selectedPole]);
  const overviewMapPoles = useMemo(() => {
    const visibleIds = new Set(
      overviewPoles.map((pole) => pole?.streetlight_id).filter(Boolean)
    );

    return mapPoles.filter((pole) => visibleIds.has(pole?.streetlight_id));
  }, [mapPoles, overviewPoles]);

  function handlePoleSelect(poleId) {
    if (!poleId) return;
    setSelectedId(poleId);
    setMapMode("selected");
  }

  function handleMapZoomOut() {
    setMapMode("all");
    setMapFitRequestKey((current) => current + 1);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const { events } = useWebSocketSync(lastMessage, setSnapshotMap);
  useTelemetryLoader(
    overviewSelectedPole?.streetlight_id,
    setSnapshotMap,
    { refreshMs: OVERVIEW_TELEMETRY_REFRESH_MS }
  );

  const selectedPoleEvents = useMemo(() => {
    if (!overviewSelectedPole?.streetlight_id) return [];

    return events.filter(
      (event) => event?.streetlightId === overviewSelectedPole.streetlight_id
    );
  }, [events, overviewSelectedPole?.streetlight_id]);

  const counts = useMemo(() => {
    const reportingPoles = overviewPoles.filter(
      (pole) => !isPoleTelemetryStale(pole, nowMs)
    );
    const total = overviewPoles.length;
    const healthy = reportingPoles.filter((pole) => {
      const health = String(pole.health || "").toUpperCase();
      return health === "OK" || health === "HEALTHY";
    }).length;
    const warning = reportingPoles.filter((pole) => {
      const health = String(pole.health || "").toUpperCase();
      return health === "DEGRADED" || health === "WARNING";
    }).length;
    const critical = reportingPoles.filter(
      (pole) => String(pole.health || "").toUpperCase() === "CRITICAL"
    ).length;
    const offline = total - reportingPoles.length;

    const status =
      critical > 0
        ? "Critical"
        : warning > 0
        ? "Warning"
        : healthy > 0
        ? "Healthy"
        : "Offline";

    return { total, healthy, warning, critical, offline, reporting: reportingPoles.length, status };
  }, [nowMs, overviewPoles]);

  const brightnessAvg = useMemo(() => {
    const values = overviewPoles
      .filter((pole) => !isPoleTelemetryStale(pole, nowMs))
      .map((pole) => pole.light_level)
      .filter((value) => Number.isFinite(Number(value)))
      .map(Number);

    if (!values.length) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [nowMs, overviewPoles]);

  const selectedPoleIsStale = isPoleTelemetryStale(overviewSelectedPole, nowMs);
  const selectedPoleHasTelemetry = hasPoleTelemetry(overviewSelectedPole);
  const selectedPoleIsLive = selectedPoleHasTelemetry && !selectedPoleIsStale;
  const showLiveReadings = wsStatus === "connected" && selectedPoleIsLive;
  const combinedSensorHealth = selectedPoleIsStale
    ? { label: "Waiting for data", tone: "neutral" }
    : getCombinedSensorHealth(overviewSelectedPole);
  const motionValue =
    showLiveReadings && typeof overviewSelectedPole?.motion_detected === "boolean"
      ? motionLabel(overviewSelectedPole.motion_detected)
      : "Waiting for data";
  const motionTone =
    showLiveReadings && overviewSelectedPole?.motion_detected === true
      ? "active"
      : showLiveReadings && overviewSelectedPole?.motion_detected === false
      ? "healthy"
      : "neutral";
  const lightValue =
    showLiveReadings && overviewSelectedPole?.light_level != null
      ? `${overviewSelectedPole.light_level}%`
      : "Waiting for data";
  const selectedPoleHealthLabel = showLiveReadings
    ? cleanDisplay(overviewSelectedPole?.health, "Waiting for data")
    : "Waiting for data";
  const selectedPoleHealthTone = showLiveReadings
    ? toneForHealth(overviewSelectedPole?.health)
    : "neutral";
  const liveMetricFallback = "Waiting for data";
  const lastSeenValue = showLiveReadings
    ? "Now"
    : formatTimestamp(overviewSelectedPole?.last_seen);
  const summaryCards = useMemo(
    () => [
      {
        icon: "shield",
        label: "System Status",
        value: counts.status,
        note: `${counts.total} pole${counts.total === 1 ? "" : "s"} available`,
        tone: counts.status === "Offline" ? "critical" : toneForHealth(counts.status),
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
        value: brightnessAvg != null ? `${brightnessAvg}%` : "Waiting",
        note:
          brightnessAvg != null
            ? "Latest average brightness"
            : "Waiting for brightness readings",
        tone: brightnessAvg != null ? "healthy" : "neutral",
      },
    ],
    [brightnessAvg, counts]
  );

  return (
    <Layout>
      <div className="lwOverviewPage lwOverviewRebuild">
        <div className="lwSummaryGrid">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="lwOverviewMainGrid lwOverviewMainGridRebuild">
          <aside className="lwOverviewLeftRail">
            <div className="lwOverviewLeftRailScroll">
              <Card title="Selected Pole" className="lwOperatorCard">
                {overviewSelectedPole ? (
                  <div className="lwSelectedPoleSurface">
                    <div className="lwSelectedHeaderCompact">
                      <div>
                        <div className="lwSelectedPoleId">
                          {overviewSelectedPole.streetlight_id}
                        </div>
                        <div className="lwSelectedPoleName">
                          {cleanDisplay(overviewSelectedPole.name, "Unnamed pole")}
                        </div>
                      </div>
                      <span
                        className={`lwMetricBadge ${selectedPoleHealthTone}`}
                      >
                        {selectedPoleHealthLabel}
                      </span>
                    </div>

                    <div className="lwMetricGridCompact">
                      <MetricRow label="Motion" value={motionValue} tone={motionTone} />
                      <MetricRow
                        label="Brightness"
                        value={lightValue}
                        tone={showLiveReadings ? "healthy" : "neutral"}
                      />
                      <MetricRow
                        label="Temperature"
                        value={renderMetricValue(
                          showLiveReadings ? overviewSelectedPole.temp_c : null,
                          (value) => `${value}°C`,
                          liveMetricFallback
                        )}
                      />
                      <MetricRow
                        label="Humidity"
                        value={renderMetricValue(
                          showLiveReadings ? overviewSelectedPole.humidity : null,
                          (value) => `${value}%`,
                          liveMetricFallback
                        )}
                      />
                      <MetricRow
                        label="Lux"
                        value={renderMetricValue(
                          showLiveReadings ? overviewSelectedPole.lux : null,
                          (value) => `${Math.round(value)}`,
                          liveMetricFallback
                        )}
                      />
                      <MetricRow
                        label="Last Seen"
                        value={lastSeenValue}
                      />
                      <MetricRow
                        label="Sensor Health"
                        value={combinedSensorHealth.label}
                        tone={combinedSensorHealth.tone}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="lwTrendEmpty">Waiting for pole selection…</div>
                )}
              </Card>

              <Card title="Pole List" className="lwOperatorCard">
                <div className="lwPoleList">
                  {overviewPoles.map((pole) => {
                    const selected =
                      pole.streetlight_id === overviewSelectedPole?.streetlight_id;
                    const poleIsStale = isPoleTelemetryStale(pole, nowMs);
                    const poleHealthLabel = poleIsStale
                      ? "No live data"
                      : cleanDisplay(pole.health, "Waiting");
                    const poleHealthTone = !poleIsStale && hasReading(pole.health)
                      ? toneForHealth(pole.health)
                      : "neutral";

                    return (
                      <button
                        key={pole.streetlight_id}
                        type="button"
                        className={`lwPoleListItem ${selected ? "isSelected" : ""}`}
                        onClick={() => handlePoleSelect(pole.streetlight_id)}
                      >
                        <div>
                          <strong>{pole.streetlight_id}</strong>
                          <small>{cleanDisplay(pole.name, "Unnamed pole")}</small>
                        </div>
                        <span
                          className={`lwMetricBadge ${poleHealthTone}`}
                        >
                          {poleHealthLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card title="Recent Activity" className="lwOperatorCard">
                <ActivityFeed events={selectedPoleEvents} wsStatus={wsStatus} maxItems={3} />
              </Card>
            </div>
          </aside>

          <Card
            title="Network Map"
            className="lwMapCardShell lwOverviewMapShell"
            actions={
              <button
                type="button"
                className="lwOverviewMapResetBtn"
                onClick={handleMapZoomOut}
              >
                Zoom Out
              </button>
            }
          >
            <MapEmbed
              title="LightWise network map"
              height={560}
              fillHeight
              lat={mapCenter.lat}
              lng={mapCenter.lng}
              poles={overviewMapPoles}
              selectedId={overviewSelectedPole?.streetlight_id}
              onSelectPole={(pole) => handlePoleSelect(pole.streetlight_id)}
              interactive
              fitToPoles={mapMode === "all"}
              focusSelected={mapMode === "selected"}
              fitRequestKey={mapFitRequestKey}
              fitMaxZoom={13}
              selectedZoom={18}
              showMotionFocus={false}
              showLegend
            />
          </Card>
        </div>
      </div>
    </Layout>
  );
}
