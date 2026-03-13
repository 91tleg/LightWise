import React, {
  createContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
} from "react";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { normalizeEvent } from "../utils/normalizeEvent";
import { listStreetlights } from "../services/api";
import { loadPoles, savePoles } from "../services/poleStorage";

export const LightWiseContext = createContext(null);

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readMotionCoordPair(candidate) {
  if (!candidate || typeof candidate !== "object") return null;

  const lat = toFiniteNumber(
    candidate?.lat ??
      candidate?.latitude ??
      candidate?.motion_lat ??
      candidate?.motionLat ??
      candidate?.motion_latitude ??
      candidate?.motionLatitude ??
      candidate?.detected_lat ??
      candidate?.detectedLat
  );

  const lng = toFiniteNumber(
    candidate?.lng ??
      candidate?.lon ??
      candidate?.longitude ??
      candidate?.motion_lng ??
      candidate?.motionLng ??
      candidate?.motion_longitude ??
      candidate?.motionLongitude ??
      candidate?.detected_lng ??
      candidate?.detectedLng
  );

  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function extractMotionFocus(source) {
  const directPair = readMotionCoordPair({
    motion_lat: source?.motion_focus_lat ?? source?.motion_lat ?? source?.detected_lat,
    motion_lng: source?.motion_focus_lng ?? source?.motion_lng ?? source?.detected_lng,
  });

  const nestedPair =
    readMotionCoordPair(source?.motion_location) ||
    readMotionCoordPair(source?.motionLocation) ||
    readMotionCoordPair(source?.detected_location) ||
    readMotionCoordPair(source?.detectedLocation) ||
    readMotionCoordPair(source?.focus_location) ||
    readMotionCoordPair(source?.focusLocation) ||
    readMotionCoordPair(source?.motion_point) ||
    readMotionCoordPair(source?.motionPoint) ||
    readMotionCoordPair(source?.data?.motion_location) ||
    readMotionCoordPair(source?.data?.motionLocation) ||
    readMotionCoordPair(source?.data?.detected_location) ||
    readMotionCoordPair(source?.data?.detectedLocation);

  const pair = directPair || nestedPair;
  const radius =
    toFiniteNumber(
      source?.motion_focus_radius_m ??
        source?.motion_radius_m ??
        source?.motionRadiusM ??
        source?.motion_distance_m ??
        source?.motionDistanceM ??
        source?.data?.motion_focus_radius_m ??
        source?.data?.motion_radius_m ??
        source?.data?.motionRadiusM ??
        source?.data?.motion_distance_m ??
        source?.data?.motionDistanceM
    ) ?? null;

  if (!pair) return null;

  return {
    motion_focus_lat: pair.lat,
    motion_focus_lng: pair.lng,
    motion_focus_radius_m: radius,
  };
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
    tenant_id: pole?.tenant_id || pole?.tenantId || pole?.tenant || null,
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
    motion_detected:
      typeof pole?.motion_detected === "boolean"
        ? pole.motion_detected
        : typeof pole?.motion === "boolean"
        ? pole.motion
        : null,
    light_level:
      typeof pole?.light_level === "number"
        ? pole.light_level
        : typeof pole?.brightness === "number"
        ? pole.brightness
        : null,
    last_seen:
      pole?.last_seen ||
      pole?.timestamp ||
      pole?.updated_at ||
      pole?.lastSeen ||
      null,
    ambient_primary_ok: pole?.ambient_primary_ok ?? null,
    ambient_secondary_ok: pole?.ambient_secondary_ok ?? null,
    th_ok: pole?.th_ok ?? null,
    motion_primary_ok: pole?.motion_primary_ok ?? null,
    motion_secondary_ok: pole?.motion_secondary_ok ?? null,
    temp_c: pole?.temp_c ?? null,
    humidity: pole?.humidity ?? null,
    lux: pole?.lux ?? null,
    ...(extractMotionFocus(pole) || {}),
  };
}

function mergeLiveIntoPole(existing, message) {
  const data = message?.data || {};
  const diagnostics = message?.diagnostics || {};
  const motionFocus = extractMotionFocus(message);

  return {
    ...existing,
    health: message?.health ?? existing?.health ?? "OK",
    motion_detected:
      typeof data?.motion === "boolean"
        ? data.motion
        : typeof message?.motion === "boolean"
        ? message.motion
        : existing?.motion_detected ?? null,
    light_level:
      clampPct(data?.light_level ?? message?.light_level ?? message?.brightness) ??
      existing?.light_level ??
      null,
    last_seen:
      message?.timestamp ||
      message?.last_seen ||
      existing?.last_seen ||
      null,
    ambient_primary_ok:
      message?.ambient_primary_ok ??
      diagnostics?.ambient_primary_ok ??
      existing?.ambient_primary_ok ??
      null,
    ambient_secondary_ok:
      message?.ambient_secondary_ok ??
      diagnostics?.ambient_secondary_ok ??
      existing?.ambient_secondary_ok ??
      null,
    th_ok: message?.th_ok ?? diagnostics?.th_ok ?? existing?.th_ok ?? null,
    motion_primary_ok:
      message?.motion_primary_ok ??
      diagnostics?.motion_primary_ok ??
      existing?.motion_primary_ok ??
      null,
    motion_secondary_ok:
      message?.motion_secondary_ok ??
      diagnostics?.motion_secondary_ok ??
      existing?.motion_secondary_ok ??
      null,
    temp_c:
      typeof message?.temp_c === "number"
        ? message.temp_c
        : typeof data?.temp_c === "number"
        ? data.temp_c
        : existing?.temp_c ?? null,
    humidity:
      typeof message?.humidity === "number"
        ? message.humidity
        : typeof data?.humidity === "number"
        ? data.humidity
        : existing?.humidity ?? null,
    lux:
      typeof message?.lux === "number"
        ? message.lux
        : typeof data?.lux === "number"
        ? data.lux
        : existing?.lux ?? null,
    ...(motionFocus || {}),
  };
}

function readOperator() {
  try {
    const raw = localStorage.getItem("lightwise_operator");
    if (!raw) {
      return {
        name: "Operator",
        email: "operator@lightwise.local",
        role: "operator",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      name: parsed?.name || "Operator",
      email: parsed?.email || "operator@lightwise.local",
      role: parsed?.role || "operator",
    };
  } catch {
    return {
      name: "Operator",
      email: "operator@lightwise.local",
      role: "operator",
    };
  }
}

function getInitials(name = "") {
  const clean = String(name).trim();
  if (!clean) return "OP";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export function LightWiseProvider({ children }) {
  const WS_URL =
    (process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || "").trim();

  const API_BASE = (process.env.REACT_APP_API_BASE || "").trim();
  const TENANT_ID = (process.env.REACT_APP_TENANT_ID || "tenant-001").trim();
  const USE_MOCK = String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true";

  const [poles, setPoles] = useState(() => loadPoles());
  const [streetlights, setStreetlights] = useState([]);
  const [events, setEvents] = useState([]);
  const [operator, setOperator] = useState(() => readOperator());

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("lightwise_dark_mode") === "true";
    } catch {
      return false;
    }
  });

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem("lightwise_operator");
      localStorage.removeItem("lightwise_auth");
    } catch {}

    window.location.href = "/login";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("lightwise_dark_mode", String(darkMode));
    } catch {}

    document.body.classList.toggle("dark", darkMode);
    document.body.classList.toggle("light", !darkMode);
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem("lightwise_operator", JSON.stringify(operator));
    } catch {}
  }, [operator]);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useLightWiseWS(WS_URL, {
      debug: false,
      autoReconnect: true,
    });

  const hasLoadedOnceRef = useRef(false);
  const prevWsStatusRef = useRef(wsStatus);

  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  const refreshStreetlights = useCallback(async () => {
    try {
      const raw = await listStreetlights();
      const rows = (Array.isArray(raw) ? raw : []).map(normalizePole);

      setStreetlights(rows);

      if (rows.length) {
        const ids = rows.map((r) => r.streetlight_id).filter(Boolean);
        setPoles((prev) => [...new Set([...(prev || []), ...ids])]);
      }

      hasLoadedOnceRef.current = true;
    } catch {
      hasLoadedOnceRef.current = true;
    }
  }, []);

  useEffect(() => {
    refreshStreetlights();
  }, [refreshStreetlights]);

  useEffect(() => {
    const prev = prevWsStatusRef.current;

    if (
      hasLoadedOnceRef.current &&
      wsStatus === "connected" &&
      (prev === "disconnected" || prev === "error")
    ) {
      refreshStreetlights();
    }

    prevWsStatusRef.current = wsStatus;
  }, [wsStatus, refreshStreetlights]);

  useEffect(() => {
    if (wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [wsStatus, poles, subscribe]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== "object") return;

    const streetlightId = String(lastMessage?.streetlight_id || "").trim();
    if (!streetlightId) return;

    setStreetlights((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const index = list.findIndex((row) => row.streetlight_id === streetlightId);

      if (index === -1) {
        const created = mergeLiveIntoPole(
          normalizePole({ streetlight_id: streetlightId }),
          lastMessage
        );
        return [created, ...list];
      }

      return list.map((row) =>
        row.streetlight_id === streetlightId ? mergeLiveIntoPole(row, lastMessage) : row
      );
    });

    setPoles((prev) => (prev.includes(streetlightId) ? prev : [...prev, streetlightId]));

    const ev = normalizeEvent(lastMessage);
    if (ev) {
      setEvents((prev) => [ev, ...prev].slice(0, 200));
    }
  }, [lastMessage]);

  const addPole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;
    setPoles((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removePole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;
    setPoles((prev) => prev.filter((p) => p !== id));
  }, []);

  const clearPoles = useCallback(() => setPoles([]), []);
  const clearEvents = useCallback(() => setEvents([]), []);

  const applyStreetlightLocalPatch = useCallback((streetlightId, patch = {}) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;

    setStreetlights((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some((row) => row.streetlight_id === id);

      if (!exists) {
        return [normalizePole({ streetlight_id: id, ...patch }), ...list];
      }

      return list.map((row) =>
        row.streetlight_id === id ? normalizePole({ ...row, ...patch }) : row
      );
    });

    setPoles((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const value = useMemo(
    () => ({
      env: {
        WS_URL,
        API_BASE,
        TENANT_ID,
        USE_MOCK,
        wsCapabilities: { subscribe: true, controls: false },
      },
      wsStatus,
      wsError,
      lastMessage,
      send,
      subscribe,
      poles,
      streetlights,
      refreshStreetlights,
      applyStreetlightLocalPatch,
      addPole,
      removePole,
      clearPoles,
      events,
      clearEvents,
      darkMode,
      setDarkMode,
      toggleDarkMode,
      operator: {
        ...operator,
        initials: getInitials(operator?.name),
      },
      setOperator,
      signOut,
    }),
    [
      WS_URL,
      API_BASE,
      TENANT_ID,
      USE_MOCK,
      wsStatus,
      wsError,
      lastMessage,
      send,
      subscribe,
      poles,
      streetlights,
      refreshStreetlights,
      applyStreetlightLocalPatch,
      addPole,
      removePole,
      clearPoles,
      events,
      clearEvents,
      darkMode,
      setDarkMode,
      toggleDarkMode,
      operator,
      setOperator,
      signOut,
    ]
  );

  return <LightWiseContext.Provider value={value}>{children}</LightWiseContext.Provider>;
}
