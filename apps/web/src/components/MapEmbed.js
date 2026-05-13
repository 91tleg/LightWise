import React, { useEffect, useMemo, useState } from "react";
import Legend from "./Legend";
import { DEFAULT_CENTER, isValidCoord, pickBestCenter } from "../utils/poleHelpers";
import { toneForPole } from "../utils/poleState";

function buildMapBounds(validPoles, center, extraPoints = []) {
  const coords = [
    ...validPoles.map((pole) => ({
      lat: Number(pole.lat),
      lng: Number(pole.lng),
    })),
    center,
    ...extraPoints
      .map((point) => ({
        lat: Number(point?.lat),
        lng: Number(point?.lng),
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
  ];

  const minLat = Math.min(...coords.map((item) => item.lat));
  const maxLat = Math.max(...coords.map((item) => item.lat));
  const minLng = Math.min(...coords.map((item) => item.lng));
  const maxLng = Math.max(...coords.map((item) => item.lng));

  const latPad = Math.max((maxLat - minLat) * 0.18, 0.0035);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.0035);

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function getMarkerPosition(pole, bounds) {
  const lat = Number(pole?.lat);
  const lng = Number(pole?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { left: "50%", top: "50%" };
  }

  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.0001);

  const left = ((lng - bounds.minLng) / lngSpan) * 100;
  const top = (1 - (lat - bounds.minLat) / latSpan) * 100;

  return {
    left: `${Math.min(94, Math.max(6, left)).toFixed(2)}%`,
      top: `${Math.min(92, Math.max(10, top)).toFixed(2)}%`,
  };
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getMotionFocusPoint(pole, focusLat, focusLng) {
  const directLat = toFiniteNumber(focusLat);
  const directLng = toFiniteNumber(focusLng);
  if (directLat != null && directLng != null) {
    return { lat: directLat, lng: directLng };
  }

  const poleLat = toFiniteNumber(pole?.motion_focus_lat);
  const poleLng = toFiniteNumber(pole?.motion_focus_lng);

  if (poleLat != null && poleLng != null) {
    return { lat: poleLat, lng: poleLng };
  }

  return null;
}

function getMotionZoom(radiusMeters = 30) {
  const radius = Number(radiusMeters);
  if (!Number.isFinite(radius) || radius <= 20) return 21;
  if (radius <= 35) return 20;
  if (radius <= 70) return 19;
  if (radius <= 150) return 18;
  return 17;
}

export default function MapEmbed({
  title = "Network map",
  height = 560,
  fillHeight = true,
  lat,
  lng,
  poles = [],
  selectedId = null,
  onSelectPole,
  interactive = false,
  showLegend = false,
  showInfo = true,
  motionDetected = false,
  focusLat = null,
  focusLng = null,
  focusRadiusMeters = 30,
  forceNativePin = false,
  showPoleMarkers = true,
}) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const validPoles = useMemo(() => {
    return (Array.isArray(poles) ? poles : []).filter(
      (pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng)
    );
  }, [poles]);

  const selectedPole = useMemo(() => {
    return (
      validPoles.find((pole) => pole?.streetlight_id === selectedId) ||
      null
    );
  }, [validPoles, selectedId]);

  const fallbackCenter = useMemo(() => {
    if (isValidCoord(lat) && isValidCoord(lng)) {
      return { lat: Number(lat), lng: Number(lng), selectedId: selectedId || null };
    }

    return pickBestCenter(validPoles);
  }, [lat, lng, selectedId, validPoles]);

  const center = useMemo(() => {
    if (selectedPole) {
      return {
        lat: Number(selectedPole.lat),
        lng: Number(selectedPole.lng),
      };
    }

    return {
      lat: Number(fallbackCenter.lat ?? DEFAULT_CENTER.lat),
      lng: Number(fallbackCenter.lng ?? DEFAULT_CENTER.lng),
    };
  }, [fallbackCenter.lat, fallbackCenter.lng, selectedPole]);

  const activePole =
    selectedPole ||
    validPoles.find((pole) => pole?.streetlight_id === fallbackCenter.selectedId) ||
    validPoles[0] ||
    null;

  const motionFocusPoint = useMemo(() => {
    if (!motionDetected || !activePole) return null;
    return getMotionFocusPoint(activePole, focusLat, focusLng);
  }, [activePole, focusLat, focusLng, motionDetected]);
  const hasMotionFocus = Boolean(motionFocusPoint);
  const bounds = useMemo(
    () => buildMapBounds(validPoles, center, motionFocusPoint ? [motionFocusPoint] : []),
    [validPoles, center, motionFocusPoint]
  );

  const markerPoles = showPoleMarkers ? validPoles : [];
  const showMarkerOverlay = interactive && (markerPoles.length > 0 || hasMotionFocus);
  const showPoleInfo = showInfo && (showPoleMarkers || hasMotionFocus);
  const explicitPinPoint = useMemo(() => {
    if (isValidCoord(lat) && isValidCoord(lng)) {
      return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  }, [lat, lng]);

  const mapPinPoint = useMemo(() => {
    if (motionFocusPoint) return motionFocusPoint;
    if (explicitPinPoint) return explicitPinPoint;
    if (activePole && isValidCoord(activePole?.lat) && isValidCoord(activePole?.lng)) {
      return { lat: Number(activePole.lat), lng: Number(activePole.lng) };
    }
    return null;
  }, [activePole, explicitPinPoint, motionFocusPoint]);

  const allowNativePin = showPoleMarkers || !interactive || hasMotionFocus;
  const nativePinMode =
    allowNativePin && (forceNativePin || !interactive || hasMotionFocus || validPoles.length <= 1);

  const zoomLevel = useMemo(() => {
    if (hasMotionFocus) {
      const radius = activePole?.motion_focus_radius_m ?? focusRadiusMeters;
      return getMotionZoom(radius);
    }

    if (forceNativePin || !interactive || validPoles.length <= 1) {
      return mapPinPoint ? 18 : 15;
    }

    return validPoles.length > 1 ? 13 : 16;
  }, [
    activePole?.motion_focus_radius_m,
    focusRadiusMeters,
    forceNativePin,
    hasMotionFocus,
    interactive,
    mapPinPoint,
    validPoles.length,
  ]);

  const mapHeightStyle = fillHeight
    ? { minHeight: 0, height: "100%" }
    : { minHeight: height, height };

  const mapSrc = nativePinMode && mapPinPoint
    ? `https://maps.google.com/maps?ll=${encodeURIComponent(
        `${mapPinPoint.lat},${mapPinPoint.lng}`
      )}&q=${encodeURIComponent(`${mapPinPoint.lat},${mapPinPoint.lng}`)}&z=${zoomLevel}&output=embed`
    : `https://maps.google.com/maps?ll=${encodeURIComponent(
        `${center.lat},${center.lng}`
      )}&z=${zoomLevel}&output=embed`;

  useEffect(() => {
    setMapLoaded(false);
  }, [mapSrc]);

  return (
    <div className="lwMapBox lwInteractiveMap isPlain" style={mapHeightStyle}>
      {validPoles.length ? (
        <>
          {!mapLoaded ? <div className="lwMapLoadingSurface" aria-hidden="true" /> : null}

          <iframe
            title={title}
            className={`lwMapFrame${mapLoaded ? " isLoaded" : ""}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            onLoad={() => setMapLoaded(true)}
            style={{ pointerEvents: showMarkerOverlay ? "none" : interactive ? "auto" : "none" }}
          />

          {showMarkerOverlay ? (
            <div className="lwMapMarkerLayer">
              {markerPoles.map((pole) => {
                const tone = toneForPole(pole);
                const isSelected = pole?.streetlight_id === activePole?.streetlight_id;

                return (
                  <button
                    key={pole.streetlight_id}
                    type="button"
                    className={`lwMapMarker lwMapMarker-${tone}${isSelected ? " isSelected" : ""}`}
                    style={getMarkerPosition(pole, bounds)}
                    onClick={() => onSelectPole?.(pole)}
                    aria-label={`Select pole ${pole.streetlight_id}`}
                  >
                    <span className="lwMapMarkerCore" />
                    <span className="lwMapMarkerLabel">{pole.streetlight_id}</span>
                  </button>
                );
              })}

              {hasMotionFocus ? (
                <div
                  className="lwMapMotionFocus"
                  style={getMarkerPosition(motionFocusPoint, bounds)}
                >
                  <span className="lwMapMotionFocusCore" />
                </div>
              ) : null}
            </div>
          ) : null}

          {showPoleInfo && activePole ? (
            <div className="lwMapInfoWindow">
              <strong>{activePole.streetlight_id}</strong>
              <span>{activePole.name || "Unnamed pole"}</span>
              {hasMotionFocus ? (
                <small>Motion focus view · {activePole?.motion_focus_radius_m || focusRadiusMeters}m</small>
              ) : null}
              <small>{activePole.health || "OK"}</small>
            </div>
          ) : null}

          {showLegend ? (
            <div className="lwMapLegendOverlay">
              <Legend compact title="Map Key" />
            </div>
          ) : null}
        </>
      ) : (
        <div className="lwTrendEmpty" style={{ margin: 12 }}>
          No saved coordinates yet. Add pole latitude and longitude in Admin to show them here.
        </div>
      )}
    </div>
  );
}
