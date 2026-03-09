import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import MapEmbed from "../components/MapEmbed";
import { listStreetlights } from "../services/api";
import { loadPoleMetaMap } from "../services/poleStorage";
import {
  DEFAULT_CENTER,
  isValidCoord,
  mergeBackendAndLocalPoles,
  normalizeStreetlightFromApi,
  pickBestCenter,
} from "../utils/poleHelpers";
import "../styles/lightwise.css";

export default function MapView() {
  const [backendPoles, setBackendPoles] = useState([]);
  const [localMeta, setLocalMeta] = useState(() => loadPoleMetaMap());
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await listStreetlights();
        const rows = (Array.isArray(raw) ? raw : []).map(
          normalizeStreetlightFromApi
        );
        const local = loadPoleMetaMap();

        if (cancelled) return;

        setLocalMeta(local);
        setBackendPoles(rows);

        const merged = mergeBackendAndLocalPoles(rows, local);
        const center = pickBestCenter(merged);

        setSelectedId((prev) => {
          if (prev && merged.some((pole) => pole.streetlight_id === prev)) {
            return prev;
          }
          return center.selectedId;
        });
      } catch {
        if (cancelled) return;

        const local = loadPoleMetaMap();
        setLocalMeta(local);
        setBackendPoles([]);

        const merged = mergeBackendAndLocalPoles([], local);
        const center = pickBestCenter(merged);

        setSelectedId((prev) => {
          if (prev && merged.some((pole) => pole.streetlight_id === prev)) {
            return prev;
          }
          return center.selectedId;
        });
      }
    }

    load();

    const onFocus = () => {
      const nextLocal = loadPoleMetaMap();
      setLocalMeta(nextLocal);

      const merged = mergeBackendAndLocalPoles(backendPoles, nextLocal);
      const center = pickBestCenter(merged);

      setSelectedId((prev) => {
        if (prev && merged.some((pole) => pole.streetlight_id === prev)) {
          return prev;
        }
        return center.selectedId;
      });
    };

    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [backendPoles]);

  const mergedPoles = useMemo(() => {
    return mergeBackendAndLocalPoles(backendPoles, localMeta);
  }, [backendPoles, localMeta]);

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
            showLegend
            showInfo={false}
          />
        </div>
      </Card>
    </Layout>
  );
}