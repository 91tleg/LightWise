import React, { useContext, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import MapEmbed from "../components/MapEmbed.js";
import { useLightWise } from "../hooks/useLightWise";
import { loadPoleMetaMap } from "../services/poleStorage";
import { readActivePoleId, writeActivePoleId } from "../services/activePoleStorage";
import {
  DEFAULT_CENTER,
  isValidCoord,
  mergeBackendAndLocalPoles,
  pickBestCenter,
} from "../utils/poleHelpers";
import "../styles/lightwise.css";

export default function MapView() {
  const { streetlights } = useLightWise();

  const [localMeta, setLocalMeta] = useState(() => loadPoleMetaMap());
  const [selectedId, setSelectedId] = useState(() => readActivePoleId());

  useEffect(() => {
    const onFocus = () => {
      setLocalMeta(loadPoleMetaMap());
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const mergedPoles = useMemo(() => {
    return mergeBackendAndLocalPoles(streetlights, localMeta);
  }, [streetlights, localMeta]);

  useEffect(() => {
    const center = pickBestCenter(mergedPoles);

    setSelectedId((prev) => {
      if (prev && mergedPoles.some((pole) => pole.streetlight_id === prev)) {
        return prev;
      }
      return center.selectedId;
    });
  }, [mergedPoles]);

  useEffect(() => {
    if (selectedId) writeActivePoleId(selectedId);
  }, [selectedId]);

  const validPoles = useMemo(() => {
    return mergedPoles.filter(
      (pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng)
    );
  }, [mergedPoles]);

  const selectedPole = useMemo(() => {
    return (
      validPoles.find((pole) => pole.streetlight_id === selectedId) ||
      validPoles[0] ||
      null
    );
  }, [validPoles, selectedId]);

  const mapCenter = selectedPole
    ? {
        lat: Number(selectedPole.lat),
        lng: Number(selectedPole.lng),
      }
    : DEFAULT_CENTER;

  const mapKey = [
    selectedPole?.streetlight_id || "none",
    mapCenter.lat,
    mapCenter.lng,
    validPoles.length,
  ].join("-");

  return (
    <Layout title="Map View" subtitle="Interactive network map.">
      <Card title="Network Map" className="lwMapCardShell">
        <div
          style={{
            width: "100%",
            minWidth: 0,
            borderRadius: "18px",
            overflow: "hidden",
          }}
        >
          <MapEmbed
            key={mapKey}
            title="Interactive LightWise Map"
            height={760}
            fillHeight={false}
            lat={mapCenter.lat}
            lng={mapCenter.lng}
            poles={validPoles}
            selectedId={selectedPole?.streetlight_id}
            onSelectPole={(pole) => setSelectedId(pole.streetlight_id)}
            interactive
            forceNativePin
            showLegend
          />
        </div>
      </Card>
    </Layout>
  );
}
