import { useEffect, useMemo, useState } from "react";
import { loadPoleMetaMap, subscribeToPoleMetaChanges } from "../services/poleStorage";
import {
  isValidCoord,
  mergeLocalMetaIntoPole,
  pickBestCenter,
} from "../utils/poleHelpers";
import { mergePoleSnapshot } from "../utils/poleState";

const CACHE_KEYS = {
  SNAPSHOTS: "lightwise_overview_snapshots_cache_v6",
  SELECTED: "lightwise_overview_selected_v6",
};

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

export function useOverviewData({ streetlights = [], tenantId = "" } = {}) {
  const [localMeta, setLocalMeta] = useState(() => loadPoleMetaMap());
  const [snapshotMap, setSnapshotMap] = useState(() =>
    readCache(CACHE_KEYS.SNAPSHOTS, {})
  );
  const [selectedId, setSelectedId] = useState(() =>
    readCache(CACHE_KEYS.SELECTED, null)
  );

  useEffect(() => {
    writeCache(CACHE_KEYS.SNAPSHOTS, snapshotMap);
  }, [snapshotMap]);

  useEffect(() => {
    writeCache(CACHE_KEYS.SELECTED, selectedId);
  }, [selectedId]);

  useEffect(() => {
    const refreshLocal = () => setLocalMeta(loadPoleMetaMap());
    window.addEventListener("focus", refreshLocal);
    const unsubscribe = subscribeToPoleMetaChanges(refreshLocal);

    return () => {
      window.removeEventListener("focus", refreshLocal);
      unsubscribe();
    };
  }, []);

  const mergedPoles = useMemo(() => {
    return (Array.isArray(streetlights) ? streetlights : []).map((pole) => {
      const withLocalMeta = mergeLocalMetaIntoPole(pole, localMeta);
      return mergePoleSnapshot(
        withLocalMeta,
        snapshotMap[withLocalMeta.streetlight_id] || {}
      );
    });
  }, [localMeta, snapshotMap, streetlights]);

  const availablePoles = useMemo(() => {
    const activeTenantId = String(tenantId || "").trim();

    return mergedPoles.filter((pole) => {
      if (!activeTenantId) return true;
      if (!pole?.tenant_id) return true;
      return String(pole.tenant_id).trim() === activeTenantId;
    });
  }, [mergedPoles, tenantId]);

  useEffect(() => {
    if (!availablePoles.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (!availablePoles.some((pole) => pole.streetlight_id === selectedId)) {
      setSelectedId(availablePoles[0]?.streetlight_id || null);
    }
  }, [availablePoles, selectedId]);

  const selectedPole = useMemo(() => {
    return (
      availablePoles.find((pole) => pole.streetlight_id === selectedId) ||
      availablePoles[0] ||
      null
    );
  }, [availablePoles, selectedId]);

  const mapPoles = useMemo(() => {
    return availablePoles.filter(
      (pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng)
    );
  }, [availablePoles]);

  const mapCenter = useMemo(() => {
    if (
      selectedPole &&
      isValidCoord(selectedPole?.lat) &&
      isValidCoord(selectedPole?.lng)
    ) {
      return {
        lat: Number(selectedPole.lat),
        lng: Number(selectedPole.lng),
      };
    }

    return pickBestCenter(mapPoles);
  }, [mapPoles, selectedPole]);

  return {
    snapshotMap,
    setSnapshotMap,
    selectedId,
    setSelectedId,
    availablePoles,
    selectedPole,
    mapPoles,
    mapCenter,
  };
}
