import { useEffect, useMemo, useRef, useState } from "react";
import { updateStreetlightMetadata } from "../services/api";
import { writeActivePoleId } from "../services/activePoleStorage";
import { useLightWise } from "./useLightWise";
import {
  loadPoleMetaMap,
  upsertPoleMeta,
} from "../services/poleStorage";
import {
  asNumberOrNull,
  validateCoordinate,
} from "../utils/poleState";
import {
  getFormValuesForPole,
  mergeBackendAndLocalPoles,
} from "../utils/poleHelpers";

function useResetTimer() {
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (callback, delay) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(callback, delay);
  };
}

export function usePoleMetadata(selectedId) {
  const { streetlights, applyStreetlightLocalPatch } = useLightWise();
  const [metaMap, setMetaMap] = useState(() => loadPoleMetaMap());
  const [nameInput, setNameInput] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const lastLoadedPoleIdRef = useRef(null);
  const queueReset = useResetTimer();

  useEffect(() => {
    if (selectedId) {
      writeActivePoleId(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    const refreshLocal = () => setMetaMap(loadPoleMetaMap());
    window.addEventListener("focus", refreshLocal);
    return () => window.removeEventListener("focus", refreshLocal);
  }, []);

  const mapPoles = useMemo(() => {
    return mergeBackendAndLocalPoles(streetlights, metaMap);
  }, [metaMap, streetlights]);

  const selectedBase = useMemo(() => {
    return mapPoles.find((pole) => pole.streetlight_id === selectedId) || mapPoles[0] || null;
  }, [mapPoles, selectedId]);

  useEffect(() => {
    if (!selectedBase) {
      setNameInput("");
      setLatInput("");
      setLngInput("");
      setIsEditing(false);
      lastLoadedPoleIdRef.current = null;
      return;
    }

    const selectedPoleId = selectedBase.streetlight_id;
    const poleChanged = lastLoadedPoleIdRef.current !== selectedPoleId;

    if (poleChanged || !isEditing) {
      const formValues = getFormValuesForPole(selectedBase, metaMap);
      setNameInput(formValues.name);
      setLatInput(formValues.lat);
      setLngInput(formValues.lng);
      lastLoadedPoleIdRef.current = selectedPoleId;
      setIsEditing(false);
    }
  }, [isEditing, metaMap, selectedBase]);

  const latError = validateCoordinate(latInput, "Latitude");
  const lngError = validateCoordinate(lngInput, "Longitude");
  const formValid = !latError && !lngError;

  async function handleSaveMetadata() {
    if (!selectedId || !formValid) return;

    setSaveState("saving");
    setSaveMsg("");

    const patch = {
      name: nameInput.trim() || null,
      lat: latInput.trim() ? Number(latInput) : null,
      lng: lngInput.trim() ? Number(lngInput) : null,
    };

    upsertPoleMeta(selectedId, patch);
    const nextMeta = loadPoleMetaMap();
    setMetaMap(nextMeta);
    applyStreetlightLocalPatch(selectedId, patch);

    try {
      await updateStreetlightMetadata(selectedId, patch);
      setSaveState("saved");
      setSaveMsg("Changes saved");
    } catch {
      setSaveState("error");
      setSaveMsg("Saved on this device. Try again to share changes with the team.");
    }

    setIsEditing(false);

    queueReset(() => {
      setSaveState("idle");
      setSaveMsg("");
    }, 1800);
  }

  async function handleClearCoords() {
    if (!selectedId) return;

    setSaveState("saving");
    setSaveMsg("");

    const patch = {
      name: nameInput.trim() || selectedBase?.name || null,
      lat: null,
      lng: null,
    };

    upsertPoleMeta(selectedId, patch);
    const nextMeta = loadPoleMetaMap();
    setMetaMap(nextMeta);
    applyStreetlightLocalPatch(selectedId, { lat: null, lng: null });

    setLatInput("");
    setLngInput("");
    setIsEditing(false);

    try {
      await updateStreetlightMetadata(selectedId, { lat: null, lng: null });
      setSaveState("saved");
      setSaveMsg("Coordinates cleared");
    } catch {
      setSaveState("error");
      setSaveMsg("Coordinates cleared on this device. Try again to share changes with the team.");
    }

    queueReset(() => {
      setSaveState("idle");
      setSaveMsg("");
    }, 1800);
  }

  const previewLat = isEditing
    ? asNumberOrNull(latInput) ?? selectedBase?.lat ?? null
    : selectedBase?.lat ?? null;
  const previewLng = isEditing
    ? asNumberOrNull(lngInput) ?? selectedBase?.lng ?? null
    : selectedBase?.lng ?? null;

  return {
    metaMap,
    mapPoles,
    selectedBase,
    nameInput,
    setNameInput,
    latInput,
    setLatInput,
    lngInput,
    setLngInput,
    isEditing,
    setIsEditing,
    saveState,
    saveMsg,
    latError,
    lngError,
    formValid,
    previewLat,
    previewLng,
    handleSaveMetadata,
    handleClearCoords,
  };
}
