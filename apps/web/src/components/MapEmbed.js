import React, { useMemo } from "react";
import Legend from "./Legend";

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeMarkers(poles = [], fallbackLat, fallbackLng) {
  const valid = (Array.isArray(poles) ? poles : [])
    .map((pole) => ({
      ...pole,
      lat: toNumber(pole?.lat),
      lng: toNumber(pole?.lng),
    }))
    .filter((pole) => pole.lat != null && pole.lng != null);

  if (!valid.length && toNumber(fallbackLat) != null && toNumber(fallbackLng) != null) {
    return [
      {
        streetlight_id: "selected",
        name: "Selected pole",
        lat: toNumber(fallbackLat),
        lng: toNumber(fallbackLng),
        health: "OK",
      },
    ];
  }

  return valid;
}

function getBounds(markers, lat, lng) {
  const all = normalizeMarkers(markers, lat, lng);

  if (!all.length) {
    return {
      markers: [],
      minLat: 47.603,
      maxLat: 47.617,
      minLng: -122.209,
      maxLng: -122.191,
    };
  }

  const lats = all.map((m) => m.lat);
  const lngs = all.map((m) => m.lng);

  return {
    markers: all,
    minLat: Math.min(...lats) - 0.002,
    maxLat: Math.max(...lats) + 0.002,
    minLng: Math.min(...lngs) - 0.002,
    maxLng: Math.max(...lngs) + 0.002,
  };
}

function markerTone(health, motion) {
  const value = String(health || "").toUpperCase();
  if (motion) return "motion";
  if (value === "CRITICAL") return "critical";
  if (value === "DEGRADED" || value === "WARNING") return "warning";
  return "healthy";
}

export default function MapEmbed({
  title = "Map",
  height = 360,
  lat = null,
  lng = null,
  zoom = 16,
  poles = [],
  selectedId,
  onSelectPole,
  showLegend = false,
  showInfo = true,
  interactive = false,
  fillHeight = false,
}) {
  const bounds = useMemo(() => getBounds(poles, lat, lng), [poles, lat, lng]);

  const src = useMemo(() => {
    const baseLat = toNumber(lat) ?? 47.6101;
    const baseLng = toNumber(lng) ?? -122.2015;
    return `https://www.google.com/maps?q=${encodeURIComponent(
      `${baseLat},${baseLng}`
    )}&z=${encodeURIComponent(String(zoom))}&output=embed`;
  }, [lat, lng, zoom]);

  const selectedPole = useMemo(() => {
    return (
      bounds.markers.find((pole) => pole.streetlight_id === selectedId) ||
      bounds.markers[0] ||
      null
    );
  }, [bounds.markers, selectedId]);

  return (
    <div
      className="lwMapBox lwInteractiveMap"
      style={{ height: fillHeight ? "100%" : height, minHeight: height }}
    >
      <iframe
        title={title}
        src={src}
        className={`lwMapFrame ${interactive ? "" : "lwMapFrameMuted"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ pointerEvents: interactive ? "auto" : "none" }}
      />

      {!interactive && (
        <div className="lwMapMarkerLayer">
          {bounds.markers.map((pole) => {
            const left =
              ((pole.lng - bounds.minLng) /
                Math.max(bounds.maxLng - bounds.minLng, 0.0001)) *
              100;
            const top =
              (1 -
                (pole.lat - bounds.minLat) /
                  Math.max(bounds.maxLat - bounds.minLat, 0.0001)) *
              100;

            const tone = markerTone(pole.health, pole.motion_detected);
            const isSelected = pole.streetlight_id === selectedId;

            return (
              <button
                key={pole.streetlight_id}
                type="button"
                className={`lwMapMarker lwMapMarker-${tone}${
                  isSelected ? " isSelected" : ""
                }`}
                style={{ left: `${left}%`, top: `${top}%` }}
                title={pole.streetlight_id}
                onClick={() => onSelectPole?.(pole)}
              >
                <span className="lwMapMarkerCore" />
                <span className="lwMapMarkerLabel">{pole.streetlight_id}</span>
              </button>
            );
          })}
        </div>
      )}

      {showInfo && selectedPole && !interactive ? (
        <div className="lwMapInfoWindow">
          <strong>{selectedPole.streetlight_id}</strong>
          <span>{selectedPole.name || "Selected pole"}</span>
          <small>
            Brightness{" "}
            {typeof selectedPole.light_level === "number"
              ? `${selectedPole.light_level}%`
              : "Waiting for data"}
          </small>
        </div>
      ) : null}

      {showLegend ? (
        <div className="lwMapLegendOverlay">
          <Legend compact />
        </div>
      ) : null}
    </div>
  );
}