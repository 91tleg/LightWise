import React, { useMemo } from "react";
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
import { getCombinedSensorHealth } from "./overview.helpers";
import {
  motionLabel,
  toneForHealth,
} from "../utils/poleState";
import "../styles/lightwise.css";
import "../styles/overview.css";

function cleanDisplay(value, fallback = "Waiting for data") {
  if (value === null || value === undefined || value === "") return fallback;
  return value;
}

function renderMetricValue(value, formatter, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  return formatter ? formatter(value) : value;
}

export default function Overview() {
  const { wsStatus, lastMessage, streetlights, env } = useLightWise();
  const {
    availablePoles,
    selectedPole,
    setSelectedId,
    setSnapshotMap,
    mapPoles,
    mapCenter,
  } = useOverviewData({
    streetlights,
    tenantId: env?.TENANT_ID,
  });
  const { events } = useWebSocketSync(lastMessage, setSnapshotMap);
  const { loading: telemetryLoading, error: telemetryError } = useTelemetryLoader(
    selectedPole?.streetlight_id,
    setSnapshotMap
  );

  const selectedPoleEvents = useMemo(() => {
    if (!selectedPole?.streetlight_id) return [];

    return events.filter((event) => event?.streetlightId === selectedPole.streetlight_id);
  }, [events, selectedPole?.streetlight_id]);

  const counts = useMemo(() => {
    const total = availablePoles.length;
    const healthy = availablePoles.filter((pole) => {
      const health = String(pole.health || "").toUpperCase();
      return health === "OK" || health === "HEALTHY";
    }).length;
    const warning = availablePoles.filter((pole) => {
      const health = String(pole.health || "").toUpperCase();
      return health === "DEGRADED" || health === "WARNING";
    }).length;
    const critical = availablePoles.filter(
      (pole) => String(pole.health || "").toUpperCase() === "CRITICAL"
    ).length;

    const status =
      critical > 0
        ? "Critical"
        : warning > 0
        ? "Warning"
        : healthy > 0
        ? "Healthy"
        : "Offline";

    return { total, healthy, warning, critical, status };
  }, [availablePoles]);

  const brightnessAvg = useMemo(() => {
    const values = availablePoles
      .map((pole) => pole.light_level)
      .filter((value) => Number.isFinite(Number(value)))
      .map(Number);

    if (!values.length) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [availablePoles]);

  const summaryCards = useMemo(
    () => [
      {
        icon: "shield",
        label: "System Status",
        value: counts.status,
        note: `${counts.total} pole${counts.total === 1 ? "" : "s"} available`,
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
        value: brightnessAvg != null ? `${brightnessAvg}%` : "Waiting",
        note:
          brightnessAvg != null
            ? "Live average across reporting poles"
            : "No live brightness telemetry yet",
        tone: brightnessAvg != null ? "healthy" : "neutral",
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
            : "critical",
        showStatusDot: true,
      },
    ],
    [brightnessAvg, counts, wsStatus]
  );

  const combinedSensorHealth = getCombinedSensorHealth(selectedPole);
  const motionValue =
    typeof selectedPole?.motion_detected === "boolean"
      ? motionLabel(selectedPole.motion_detected)
      : "Waiting for data";
  const motionTone =
    selectedPole?.motion_detected === true
      ? "active"
      : selectedPole?.motion_detected === false
      ? "healthy"
      : "neutral";
  const lightValue =
    selectedPole?.light_level != null
      ? `${selectedPole.light_level}%`
      : telemetryLoading
      ? "Loading"
      : telemetryError
      ? "Unavailable"
      : "Waiting for data";

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
                {selectedPole ? (
                  <div className="lwSelectedPoleSurface">
                    <div className="lwSelectedHeaderCompact">
                      <div>
                        <div className="lwSelectedPoleId">{selectedPole.streetlight_id}</div>
                        <div className="lwSelectedPoleName">
                          {cleanDisplay(selectedPole.name, "Unnamed pole")}
                        </div>
                      </div>
                      <span className={`lwMetricBadge ${toneForHealth(selectedPole.health)}`}>
                        {cleanDisplay(selectedPole.health, "Waiting for data")}
                      </span>
                    </div>

                    <div className="lwMetricGridCompact" style={{ marginTop: 12, gap: 10 }}>
                      <MetricRow label="Motion" value={motionValue} tone={motionTone} />
                      <MetricRow label="Brightness" value={lightValue} tone="healthy" />
                      <MetricRow
                        label="Temperature"
                        value={renderMetricValue(
                          selectedPole.temp_c,
                          (value) => `${value}°C`,
                          telemetryError ? "Unavailable" : "Waiting for data"
                        )}
                      />
                      <MetricRow
                        label="Humidity"
                        value={renderMetricValue(
                          selectedPole.humidity,
                          (value) => `${value}%`,
                          telemetryError ? "Unavailable" : "Waiting for data"
                        )}
                      />
                      <MetricRow
                        label="Lux"
                        value={renderMetricValue(
                          selectedPole.lux,
                          (value) => `${Math.round(value)}`,
                          telemetryError ? "Unavailable" : "Waiting for data"
                        )}
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
                  </div>
                ) : (
                  <div className="lwTrendEmpty">Waiting for pole selection…</div>
                )}
              </Card>

              <Card title="Pole List" className="lwOperatorCard">
                <div className="lwPoleList">
                  {availablePoles.map((pole) => {
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
                          {cleanDisplay(pole.health, "Waiting")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card title="Recent Activity" className="lwOperatorCard">
                <ActivityFeed events={selectedPoleEvents} wsStatus={wsStatus} maxItems={5} />
              </Card>
            </div>
          </aside>

          <Card title="Network Map" className="lwMapCardShell lwOverviewMapShell">
            <MapEmbed
              title="LightWise network map"
              height={560}
              fillHeight
              lat={mapCenter.lat}
              lng={mapCenter.lng}
              poles={mapPoles}
              selectedId={selectedPole?.streetlight_id}
              onSelectPole={(pole) => setSelectedId(pole.streetlight_id)}
              interactive
              forceNativePin
              showLegend
            />
          </Card>
        </div>
      </div>
    </Layout>
  );
}
