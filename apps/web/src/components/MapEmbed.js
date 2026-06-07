import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Legend from "./Legend";
import { DEFAULT_CENTER, isValidCoord, pickBestCenter } from "../utils/poleHelpers";
import { toneForPole } from "../utils/poleState";

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function normalizePoint(point) {
  if (!point || !isValidCoord(point.lat) || !isValidCoord(point.lng)) {
    return null;
  }

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
  };
}

function fitMapToPoints(map, points, { maxZoom = 14, padding = [48, 48] } = {}) {
  const latLngs = points
    .map(normalizePoint)
    .filter(Boolean)
    .map((point) => [point.lat, point.lng]);

  if (!latLngs.length) {
    map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
    return;
  }

  if (latLngs.length === 1) {
    map.setView(latLngs[0], Math.min(maxZoom, 15));
    return;
  }

  map.fitBounds(L.latLngBounds(latLngs), {
    animate: true,
    maxZoom,
    padding,
  });
}

function makePoleIcon(pole, isSelected) {
  const tone = toneForPole(pole);
  const safeId = escapeHtml(pole?.streetlight_id);

  return L.divIcon({
    className: `lwLeafletMarkerIcon lwMapMarker-${tone}${isSelected ? " isSelected" : ""}`,
    html: `
      <button type="button" class="lwLeafletMarkerButton" aria-label="Select streetlight ${safeId}">
        <span class="lwMapMarkerCore"></span>
      </button>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function makePreviewIcon() {
  return L.divIcon({
    className: "lwLeafletMarkerIcon lwMapPreviewIcon",
    html: '<span class="lwMapPreviewCore"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
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
  showMotionFocus = true,
  fitToPoles = false,
  fitRequestKey = 0,
  focusSelected = false,
  selectedZoom = 18,
  fitMaxZoom = 14,
  previewPoint = null,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const onSelectPoleRef = useRef(onSelectPole);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const validPoles = useMemo(() => {
    return (Array.isArray(poles) ? poles : [])
      .filter((pole) => isValidCoord(pole?.lat) && isValidCoord(pole?.lng))
      .map((pole) => ({
        ...pole,
        lat: Number(pole.lat),
        lng: Number(pole.lng),
      }));
  }, [poles]);

  const selectedPole = useMemo(() => {
    return validPoles.find((pole) => pole?.streetlight_id === selectedId) || null;
  }, [validPoles, selectedId]);

  const fallbackCenter = useMemo(() => {
    if (isValidCoord(lat) && isValidCoord(lng)) {
      return { lat: Number(lat), lng: Number(lng), selectedId: selectedId || null };
    }

    return pickBestCenter(validPoles);
  }, [lat, lng, selectedId, validPoles]);

  const activePole =
    selectedPole ||
    validPoles.find((pole) => pole?.streetlight_id === fallbackCenter.selectedId) ||
    validPoles[0] ||
    null;

  const normalizedPreviewPoint = useMemo(
    () => normalizePoint(previewPoint),
    [previewPoint]
  );

  const motionFocusPoint = useMemo(() => {
    if (!showMotionFocus || !motionDetected || !activePole) return null;
    return getMotionFocusPoint(activePole, focusLat, focusLng);
  }, [activePole, focusLat, focusLng, motionDetected, showMotionFocus]);
  const hasMotionFocus = Boolean(motionFocusPoint);
  const showPoleInfo = showInfo && (showPoleMarkers || hasMotionFocus);

  const explicitPinPoint = useMemo(() => {
    if (isValidCoord(lat) && isValidCoord(lng)) {
      return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  }, [lat, lng]);

  const mapPinPoint = useMemo(() => {
    if (motionFocusPoint) return motionFocusPoint;
    if (normalizedPreviewPoint) return normalizedPreviewPoint;
    if (explicitPinPoint) return explicitPinPoint;
    if (activePole && isValidCoord(activePole?.lat) && isValidCoord(activePole?.lng)) {
      return { lat: Number(activePole.lat), lng: Number(activePole.lng) };
    }
    return null;
  }, [activePole, explicitPinPoint, motionFocusPoint, normalizedPreviewPoint]);

  const initialCenter = mapPinPoint || {
    lat: Number(fallbackCenter.lat ?? DEFAULT_CENTER.lat),
    lng: Number(fallbackCenter.lng ?? DEFAULT_CENTER.lng),
  };
  const initialCenterRef = useRef(initialCenter);

  const fitPoints = useMemo(() => {
    return [
      ...validPoles.map((pole) => ({ lat: pole.lat, lng: pole.lng })),
      ...(normalizedPreviewPoint ? [normalizedPreviewPoint] : []),
      ...(motionFocusPoint ? [motionFocusPoint] : []),
    ];
  }, [motionFocusPoint, normalizedPreviewPoint, validPoles]);

  const fitPointsKey = useMemo(
    () => fitPoints.map((point) => `${point.lat},${point.lng}`).join("|"),
    [fitPoints]
  );

  const mapHeightStyle = fillHeight
    ? { minHeight: 0, height: "100%" }
    : { minHeight: height, height };

  useEffect(() => {
    onSelectPoleRef.current = onSelectPole;
  }, [onSelectPole]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return undefined;

    const map = L.map(mapNodeRef.current, {
      center: [initialCenterRef.current.lat, initialCenterRef.current.lng],
      zoom: 14,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive,
    });

    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 22,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });

    tileLayer.on("load", () => setMapLoaded(true));
    tileLayer.addTo(map);

    tileLayerRef.current = tileLayer;
    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapReady(true);

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      markerLayerRef.current = null;
      tileLayerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [interactive]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    window.requestAnimationFrame(() => {
      mapRef.current?.invalidateSize();
    });
  }, [fillHeight, height, mapReady]);

  useEffect(() => {
    if (!mapReady || !markerLayerRef.current) return;

    const markerLayer = markerLayerRef.current;
    markerLayer.clearLayers();

    if (showPoleMarkers) {
      validPoles.forEach((pole) => {
        const isSelected = pole?.streetlight_id === activePole?.streetlight_id;
        const marker = L.marker([pole.lat, pole.lng], {
          icon: makePoleIcon(pole, isSelected),
          keyboard: true,
          riseOnHover: true,
          title: `Select streetlight ${pole.streetlight_id}`,
        });

        marker.on("click", () => {
          onSelectPoleRef.current?.(pole);
        });

        marker.bindTooltip(escapeHtml(pole.streetlight_id), {
          permanent: true,
          direction: "top",
          offset: [0, -13],
          className: `lwMapMarkerTooltip${isSelected ? " isSelected" : ""}`,
        });

        marker.addTo(markerLayer);
      });
    }

    if (normalizedPreviewPoint) {
      L.marker([normalizedPreviewPoint.lat, normalizedPreviewPoint.lng], {
        icon: makePreviewIcon(),
        interactive: false,
        title: "Preview location",
      })
        .bindTooltip("Preview", {
          permanent: true,
          direction: "top",
          offset: [0, -15],
          className: "lwMapMarkerTooltip isPreview",
        })
        .addTo(markerLayer);
    }

    if (hasMotionFocus && motionFocusPoint) {
      const radius = Number(activePole?.motion_focus_radius_m || focusRadiusMeters) || 30;

      L.circle([motionFocusPoint.lat, motionFocusPoint.lng], {
        radius,
        color: "#0ea5e9",
        fillColor: "#38bdf8",
        fillOpacity: 0.14,
        opacity: 0.62,
        weight: 2,
        interactive: false,
      }).addTo(markerLayer);

      L.circleMarker([motionFocusPoint.lat, motionFocusPoint.lng], {
        radius: 8,
        color: "#ffffff",
        fillColor: "#0ea5e9",
        fillOpacity: 1,
        weight: 3,
        interactive: false,
      }).addTo(markerLayer);
    }
  }, [
    activePole?.motion_focus_radius_m,
    activePole?.streetlight_id,
    focusRadiusMeters,
    hasMotionFocus,
    mapReady,
    motionFocusPoint,
    normalizedPreviewPoint,
    showPoleMarkers,
    validPoles,
  ]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !fitToPoles) return;

    fitMapToPoints(mapRef.current, fitPoints.length ? fitPoints : [initialCenterRef.current], {
      maxZoom: fitMaxZoom,
    });
  }, [fitMaxZoom, fitPoints, fitPointsKey, fitRequestKey, fitToPoles, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || fitToPoles || !forceNativePin || !mapPinPoint) {
      return;
    }

    mapRef.current.setView([mapPinPoint.lat, mapPinPoint.lng], selectedZoom, {
      animate: true,
    });
  }, [fitToPoles, forceNativePin, mapPinPoint, mapReady, selectedZoom]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !focusSelected) return;

    const focusPoint = motionFocusPoint || selectedPole;
    if (!focusPoint || !isValidCoord(focusPoint.lat) || !isValidCoord(focusPoint.lng)) {
      return;
    }

    const zoom = motionFocusPoint
      ? getMotionZoom(activePole?.motion_focus_radius_m || focusRadiusMeters)
      : selectedZoom;

    mapRef.current.setView([Number(focusPoint.lat), Number(focusPoint.lng)], zoom, {
      animate: true,
    });
  }, [
    activePole?.motion_focus_radius_m,
    focusRadiusMeters,
    focusSelected,
    mapReady,
    motionFocusPoint,
    selectedPole,
    selectedZoom,
  ]);

  return (
    <div className="lwMapBox lwInteractiveMap isPlain" style={mapHeightStyle}>
      {validPoles.length || normalizedPreviewPoint ? (
        <>
          {!mapLoaded ? <div className="lwMapLoadingSurface" aria-hidden="true" /> : null}

          <div
            ref={mapNodeRef}
            className={`lwLeafletMap${mapLoaded ? " isLoaded" : ""}`}
            role="application"
            aria-label={title}
          />

          {showPoleInfo && activePole ? (
            <div className="lwMapInfoWindow">
              <strong>{activePole.streetlight_id}</strong>
              <span>{activePole.name || "Unnamed streetlight"}</span>
              {hasMotionFocus ? (
                <small>Motion focus view - {activePole?.motion_focus_radius_m || focusRadiusMeters}m</small>
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
          No saved coordinates yet. Add streetlight latitude and longitude in Admin to show them here.
        </div>
      )}
    </div>
  );
}
