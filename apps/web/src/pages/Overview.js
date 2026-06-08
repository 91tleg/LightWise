import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed.js";
import Card from "../components/Card";
import ActivityFeed from "../components/ActivityFeed";
import SummaryCard from "../components/SummaryCard";
import MetricRow from "../components/MetricRow";
import { useLightWise } from "../hooks/useLightWise";
import { useOverviewData } from "../hooks/useOverviewData";
import { useWebSocketSync } from "../hooks/useWebSocketSync";
import { formatTimestamp } from "../utils/formatters";
import {
  getOverviewConnectionSummary,
  getCombinedSensorHealth,
  getOverviewFaultSummary,
  getOverviewPoleList,
  isPoleTelemetryStale,
} from "./overview.helpers";
import {
  motionLabel,
} from "../utils/poleState";
import "../styles/lightwise.css";
import "../styles/overview.css";

const OVERVIEW_STATUS_TICK_MS = 5 * 1000;

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
  const [mapMode, setMapMode] = useState("all");
  const [mapFitRequestKey, setMapFitRequestKey] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const {
    availablePoles,
    selectedId,
    selectedPole,
    setSelectedId,
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
    const timer = window.setInterval(
      () => setCurrentTimeMs(Date.now()),
      OVERVIEW_STATUS_TICK_MS
    );
    return () => window.clearInterval(timer);
  }, []);

  const { events } = useWebSocketSync(lastMessage);

  const selectedPoleEvents = useMemo(() => {
    if (!overviewSelectedPole?.streetlight_id) return [];

    return events.filter(
      (event) => event?.streetlightId === overviewSelectedPole.streetlight_id
    );
  }, [events, overviewSelectedPole?.streetlight_id]);

  const counts = useMemo(() => {
    const reportingPoles = overviewPoles.filter(
      (pole) => !isPoleTelemetryStale(pole, currentTimeMs)
    );
    const connection = getOverviewConnectionSummary(overviewPoles, currentTimeMs);
    const total = overviewPoles.length;
    const faults = getOverviewFaultSummary(overviewPoles, currentTimeMs);
    return {
      total,
      warning: faults.warning,
      critical: faults.critical,
      offline: connection.offline,
      reporting: reportingPoles.length,
      connection,
    };
  }, [currentTimeMs, overviewPoles]);

  const selectedPoleIsOffline = overviewSelectedPole
    ? isPoleTelemetryStale(overviewSelectedPole, currentTimeMs)
    : true;
  const selectedPoleHasTelemetry = hasPoleTelemetry(overviewSelectedPole);
  const showLiveReadings = selectedPoleHasTelemetry && !selectedPoleIsOffline;
  const combinedSensorHealth = selectedPoleIsOffline
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
  const selectedPoleHealthLabel = selectedPoleIsOffline
    ? "Offline"
    : showLiveReadings
    ? "Online"
    : "Waiting for data";
  const selectedPoleHealthTone = selectedPoleIsOffline
    ? "warning"
    : showLiveReadings
    ? "healthy"
    : "neutral";
  const liveMetricFallback = "Waiting for data";
  const lastSeenValue = formatTimestamp(overviewSelectedPole?.last_seen);
  const summaryCards = useMemo(
    () => [
      {
        icon: "shield",
        label: "System Status",
        value: counts.connection.status,
        note: counts.connection.note,
        tone: counts.connection.tone,
        showStatusDot: counts.total > 0,
      },
      {
        icon: "alert",
        label: "Faults Detected",
        value: String(counts.warning + counts.critical),
        note:
          counts.warning + counts.critical
            ? "Needs operator attention"
            : counts.offline
            ? "No active faults among online streetlights"
            : "No active faults",
        tone: counts.warning + counts.critical ? "warning" : "healthy",
      },
    ],
    [counts]
  );

  return (
    <Layout pageClassName="lwOverviewViewport">
      <div className="lwOverviewPage lwOverviewRebuild">
        <div className="lwSummaryGrid">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </div>

        <div className="lwOverviewMainGrid lwOverviewMainGridRebuild">
          <aside className="lwOverviewLeftRail">
            <div className="lwOverviewLeftRailScroll">
              <Card title="Selected Streetlight" className="lwOperatorCard">
                {overviewSelectedPole ? (
                  <div className="lwSelectedPoleSurface">
                    <div className="lwSelectedHeaderCompact">
                      <div>
                        <div className="lwSelectedPoleId">
                          {overviewSelectedPole.streetlight_id}
                        </div>
                        <div className="lwSelectedPoleName">
                          {cleanDisplay(overviewSelectedPole.name, "Unnamed streetlight")}
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
                  <div className="lwTrendEmpty">Waiting for streetlight selection...</div>
                )}
              </Card>

              <Card title="Streetlight List" className="lwOperatorCard">
                <div className="lwPoleList">
                  {overviewPoles.map((pole) => {
                    const selected =
                      pole.streetlight_id === overviewSelectedPole?.streetlight_id;
                    const poleIsStale = isPoleTelemetryStale(pole, currentTimeMs);
                    const poleHealthLabel = poleIsStale
                      ? "Offline"
                      : "Online";
                    const poleHealthTone = poleIsStale ? "warning" : "healthy";

                    return (
                      <button
                        key={pole.streetlight_id}
                        type="button"
                        className={`lwPoleListItem ${selected ? "isSelected" : ""}`}
                        onClick={() => handlePoleSelect(pole.streetlight_id)}
                      >
                        <div>
                          <strong>{pole.streetlight_id}</strong>
                          <small>{cleanDisplay(pole.name, "Unnamed streetlight")}</small>
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
