import { useEffect, useMemo, useState } from "react";
import { isValidCoord, pickBestCenter } from "../utils/poleHelpers";

export function useOverviewData({ streetlights = [], tenantId = "" } = {}) {
  const [selectedId, setSelectedId] = useState(null);

  const mergedPoles = useMemo(() => {
    return Array.isArray(streetlights) ? streetlights : [];
  }, [streetlights]);

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
    selectedId,
    setSelectedId,
    availablePoles,
    selectedPole,
    mapPoles,
    mapCenter,
  };
}
