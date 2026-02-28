// src/hooks/useTelemetry.js

import { useEffect, useState } from "react";
import { getStreetlightTelemetry } from "../services/api";

export function useTelemetry(streetlightId, { from, to, interval = "5m" } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(streetlightId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!streetlightId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    getStreetlightTelemetry(streetlightId, { from, to, interval })
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [streetlightId, from, to, interval]);

  return { data, loading, error };
}