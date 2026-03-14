import { useEffect, useState } from "react";
import { getStreetlightTelemetry } from "../services/api";
import { normalizeTelemetryRows } from "../pages/analytics.helpers";
import {
  mergeTelemetrySnapshot,
  snapshotFromTelemetryRow,
} from "../utils/poleState";

export function useTelemetryLoader(selectedPoleId, setSnapshotMap) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTelemetry() {
      if (!selectedPoleId) {
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const to = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z");

      try {
        const points = await getStreetlightTelemetry(selectedPoleId, {
          from,
          to,
          interval: "1h",
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

    return () => {
      cancelled = true;
    };
  }, [selectedPoleId, setSnapshotMap]);

  return { loading, error };
}
