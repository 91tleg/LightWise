import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Card from "../components/Card";
import MapEmbed from "../components/MapEmbed";
import { listStreetlights } from "../services/api";
import { loadPoleMetaMap } from "../services/poleStorage";
import "../styles/lightwise.css";

const DEFAULT_CENTER = {
  lat: 47.6101,
  lng: -122.2015,
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function isValidCoord(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function normalizePole(pole, index = 0) {
  const id =
    pole?.streetlight_id ||
    pole?.id ||
    pole?.pole_id ||
    pole?.device_id ||
    pole?.streetlightId ||
    `LW-${String(index + 1).padStart(5, "0")}`;

  return {
    streetlight_id: id,
    name: pole?.name || pole?.label || pole?.display_name || null,
    health: pole?.health || pole?.status || "OK",
    lat:
      pole?.lat ??
      pole?.latitude ??
      pole?.location?.lat ??
      pole?.location?.latitude ??
      null,
    lng:
      pole?.lng ??
      pole?.lon ??
      pole?.longitude ??
      pole?.location?.lng ??
      pole?.location?.lon ??
      pole?.location?.longitude ??
      null,
    light_level:
      typeof pole?.light_level === "number"
        ? pole.light_level
        : typeof pole?.brightness === "number"
        ? pole.brightness
        : 0,
    motion_detected:
      typeof pole?.motion_detected === "boolean"
        ? pole.motion_detected
        : typeof pole?.motion === "boolean"
        ? pole.motion
        : false,
  };
}

function mergeLocalMeta(pole, localMeta) {
  const local = localMeta[pole.streetlight_id] || {};

  return {
    ...pole,
    name: hasOwn(local, "name") ? local.name : pole.name,
    lat: hasOwn(local, "lat") ? local.lat : pole.lat,
    lng: hasOwn(local, "lng") ? local.lng : pole.lng,
  };
}

function buildLocalOnlyPoles(localMeta) {
  return Object.keys(localMeta || {}).map((id) => {
    const local = localMeta[id] || {};
    return {
      streetlight_id: id,
      name: hasOwn(local, "name") ? local.name : "Unnamed pole",
      health: "OK",
      lat: hasOwn(local, "lat") ? local.lat : null,
      lng: hasOwn(local, "lng") ? local.lng : null,
      light_level: 0,
      motion_detected: false,
    };
  });
}

function mergeBackendAndLocal(backendPoles, localMeta) {
  const mergedBackend = backendPoles.map((pole) => mergeLocalMeta(pole, localMeta));
  const seen = new Set(mergedBackend.map((pole) => pole.streetlight_id));

  const localOnly = buildLocalOnlyPoles(localMeta)
    .filter((pole) => !seen.has(pole.streetlight_id))
    .map((pole) => mergeLocalMeta(pole, localMeta));

  return [...mergedBackend, ...localOnly];
}

function pickBestCenter(poles) {
  const firstValid = poles.find(
    (pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng)
  );

  if (firstValid) {
    return {
      lat: Number(firstValid.lat),
      lng: Number(firstValid.lng),
      selectedId: firstValid.streetlight_id,
    };
  }

  return {
    ...DEFAULT_CENTER,
    selectedId: null,
  };
}

export default function MapView() {
  const [backendPoles, setBackendPoles] = useState([]);
  const [localMeta, setLocalMeta] = useState(() => loadPoleMetaMap());
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = await listStreetlights();
        const rows = (Array.isArray(raw) ? raw : []).map(normalizePole);
        const local = loadPoleMetaMap();

        if (cancelled) return;

        setLocalMeta(local);
        setBackendPoles(rows);

        const merged = mergeBackendAndLocal(rows, local);
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

        const merged = mergeBackendAndLocal([], local);
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

      const merged = mergeBackendAndLocal(backendPoles, nextLocal);
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
    return mergeBackendAndLocal(backendPoles, localMeta);
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