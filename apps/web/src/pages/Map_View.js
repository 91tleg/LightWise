// apps/web/src/pages/Map_View.js

import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import MapEmbed from "../components/MapEmbed";

import { loadPoles, loadPoleMetaMap } from "../services/poleStorage";

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

export default function Map_View() {
  const [poles, setPoles] = useState(() => loadPoles());
  const [metaMap, setMetaMap] = useState(() => loadPoleMetaMap());

  // In case localStorage changes while app is open, refresh once on mount.
  useEffect(() => {
    setPoles(loadPoles());
    setMetaMap(loadPoleMetaMap());
  }, []);

  // Choose the first pole that has valid coordinates
  const bestPin = useMemo(() => {
    const ids = Array.isArray(poles) ? poles : [];
    for (const id of ids) {
      const m = metaMap?.[id];
      if (!m) continue;
      if (isFiniteNumber(m.lat) && isFiniteNumber(m.lng)) {
        return { id, lat: m.lat, lng: m.lng };
      }
    }
    return null;
  }, [poles, metaMap]);

  return (
    <Layout title="Map" subtitle="Showing Bellevue College area (pins later).">
      <MapEmbed
        title={bestPin ? `Pin: ${bestPin.id}` : "Bellevue College Area"}
        height={520}
        lat={bestPin?.lat ?? null}
        lng={bestPin?.lng ?? null}
        zoom={bestPin ? 17 : 15}
      />
    </Layout>
  );
}