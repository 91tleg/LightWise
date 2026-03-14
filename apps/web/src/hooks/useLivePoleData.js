import { useEffect, useMemo, useState } from "react";
import { useLightWise } from "./useLightWise";
import { getStreetlightTelemetry } from "../services/api";
import { normalizeTelemetryRows } from "../pages/analytics.helpers";
import {
  buildPoleEvent,
  mergeTelemetrySnapshot,
  snapshotFromPole,
  snapshotFromTelemetryRow,
  snapshotFromWsMessage,
} from "../utils/poleState";

export function useLivePoleData(selectedId) {
  const { streetlights, lastMessage } = useLightWise();
  const [latestTelemetry, setLatestTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState(null);
  const [events, setEvents] = useState([]);

  const selectedStreetlight = useMemo(() => {
    return streetlights.find((pole) => pole?.streetlight_id === selectedId) || null;
  }, [selectedId, streetlights]);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestTelemetry() {
      if (!selectedId) {
        setLatestTelemetry(null);
        setTelemetryLoading(false);
        setTelemetryError(null);
        return;
      }

      setTelemetryLoading(true);
      setTelemetryError(null);

      const to = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");

      try {
        const payload = await getStreetlightTelemetry(selectedId, {
          from,
          to,
          interval: "1h",
        });

        if (cancelled) return;

        const rows = normalizeTelemetryRows(payload);
        const latest = rows.length ? rows[rows.length - 1] : null;
        setLatestTelemetry(latest);
      } catch (nextError) {
        if (!cancelled) {
          setLatestTelemetry(null);
          setTelemetryError(nextError);
        }
      } finally {
        if (!cancelled) {
          setTelemetryLoading(false);
        }
      }
    }

    loadLatestTelemetry();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const liveSnapshot = useMemo(() => {
    const base = snapshotFromPole(selectedStreetlight) || {};
    const telemetrySnapshot = snapshotFromTelemetryRow(latestTelemetry) || {};
    const mergedTelemetry = mergeTelemetrySnapshot(base, telemetrySnapshot);

    if (lastMessage?.streetlight_id === selectedId) {
      return mergeTelemetrySnapshot(mergedTelemetry, snapshotFromWsMessage(lastMessage));
    }

    return mergedTelemetry;
  }, [lastMessage, latestTelemetry, selectedId, selectedStreetlight]);

  const live = useMemo(() => {
    if (!selectedStreetlight && !latestTelemetry && lastMessage?.streetlight_id !== selectedId) {
      return null;
    }

    return {
      motion:
        typeof liveSnapshot?.motion_detected === "boolean"
          ? liveSnapshot.motion_detected
          : null,
      lightPct:
        liveSnapshot?.light_level != null ? liveSnapshot.light_level : null,
      lux: liveSnapshot?.lux ?? null,
      tempC: liveSnapshot?.temp_c ?? null,
      humidity: liveSnapshot?.humidity ?? null,
      health: liveSnapshot?.health ?? null,
      timestamp: liveSnapshot?.timestamp ?? null,
    };
  }, [lastMessage?.streetlight_id, latestTelemetry, liveSnapshot, selectedId, selectedStreetlight]);

  useEffect(() => {
    if (!lastMessage || lastMessage?.streetlight_id !== selectedId) return;

    const snapshot = snapshotFromWsMessage(lastMessage);
    if (!snapshot) return;

    const item = buildPoleEvent(
      selectedId,
      snapshot,
      lastMessage?.timestamp || new Date().toISOString()
    );

    setEvents((prev) => [item, ...prev].slice(0, 15));
  }, [lastMessage, selectedId]);

  return {
    selectedStreetlight,
    live,
    events,
    telemetryLoading,
    telemetryError,
  };
}
