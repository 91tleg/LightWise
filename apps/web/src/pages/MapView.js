import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import MapEmbed from "../components/MapEmbed.js";
import { useLightWise } from "../hooks/useLightWise";
import { loadPoleMetaMap, subscribeToPoleMetaChanges } from "../services/poleStorage";
import { readActivePoleId, writeActivePoleId } from "../services/activePoleStorage";
import {
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
    const unsubscribe = subscribeToPoleMetaChanges(onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      unsubscribe();
    };
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

  const mapCenter = useMemo(() => pickBestCenter(validPoles), [validPoles]);

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
            title="Interactive LightWise Map"
            height={760}
            fillHeight={false}
            lat={mapCenter.lat}
            lng={mapCenter.lng}
            poles={validPoles}
            selectedId={selectedId}
            onSelectPole={(pole) => setSelectedId(pole.streetlight_id)}
            interactive
            fitToPoles
            fitMaxZoom={16}
            showLegend
          />
        </div>
      </Card>
    </Layout>
  );
}
