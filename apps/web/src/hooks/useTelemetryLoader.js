import { useEffect, useState } from "react";
import { getStreetlightTelemetry } from "../services/api";
import { normalizeTelemetryRows } from "../pages/analytics.helpers";
import {
  mergeTelemetrySnapshot,
  snapshotFromTelemetryRow,
} from "../utils/poleState";

const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export function useTelemetryLoader(
  selectedPoleId,
  setSnapshotMap,
  { refreshMs = 0, lookbackMs = DEFAULT_LOOKBACK_MS, interval = "5m" } = {}
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;

    async function loadTelemetry({ showLoading = true } = {}) {
      if (!selectedPoleId) {
        setLoading(false);
        setError(null);
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      const to = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const from = new Date(Date.now() - lookbackMs)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");

      try {
        const points = await getStreetlightTelemetry(selectedPoleId, {
          from,
          to,
          interval,
        });

        if (cancelled) return;

        const rows = normalizeTelemetryRows(points);
        const latest = rows.length ? snapshotFromTelemetryRow(rows[rows.length - 1]) : null;

        if (latest) {
          setSnapshotMap((prev) => ({
            ...prev,
            [selectedPoleId]: mergeTelemetrySnapshot(prev[selectedPoleId] || {}, latest),
          }));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTelemetry();
    if (refreshMs > 0) {
      refreshTimer = window.setInterval(
        () => loadTelemetry({ showLoading: false }),
        refreshMs
      );
    }

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [interval, lookbackMs, refreshMs, selectedPoleId, setSnapshotMap]);

  return { loading, error };
}
