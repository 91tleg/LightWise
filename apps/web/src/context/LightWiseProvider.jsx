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
import { CONTEXT_ENV, LIGHTWISE_ENV } from "../config/env";
import { mergePoleSnapshot, snapshotFromWsMessage } from "../utils/poleState";
import { normalizeStreetlightFromApi } from "../utils/poleHelpers";

export const LightWiseContext = createContext(null);

function readOperator() {
  try {
    const raw = sessionStorage.getItem("lightwise_operator");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.name || !parsed?.email || !parsed?.role) {
      return null;
    }

    return {
      name: String(parsed.name),
      email: String(parsed.email),
      role: String(parsed.role).toLowerCase(),
    };
  } catch {
    return null;
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
  const [poles, setPoles] = useState(() => loadPoles());
  const [streetlights, setStreetlights] = useState([]);
  const [events, setEvents] = useState([]);
  const [operator, setOperator] = useState(() => readOperator());

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem("lightwise_operator");
      sessionStorage.removeItem("lightwise_auth");
      localStorage.removeItem("lightwise_operator");
      localStorage.removeItem("lightwise_auth");
    } catch {}

    window.location.href = "/login";
  }, []);

  useEffect(() => {
    try {
      if (operator) {
        sessionStorage.setItem("lightwise_operator", JSON.stringify(operator));
      } else {
        sessionStorage.removeItem("lightwise_operator");
      }
    } catch {}
  }, [operator]);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useLightWiseWS(LIGHTWISE_ENV.WS_URL, {
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
      const rows = (Array.isArray(raw) ? raw : []).map(normalizeStreetlightFromApi);

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
      const snapshot = snapshotFromWsMessage(lastMessage);

      if (index === -1) {
        const created = mergePoleSnapshot(
          normalizeStreetlightFromApi({ streetlight_id: streetlightId }),
          snapshot
        );
        return [created, ...list];
      }

      return list.map((row) =>
        row.streetlight_id === streetlightId ? mergePoleSnapshot(row, snapshot) : row
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
        return [
          normalizeStreetlightFromApi({ streetlight_id: id, ...patch }),
          ...list,
        ];
      }

      return list.map((row) =>
        row.streetlight_id === id
          ? normalizeStreetlightFromApi({ ...row, ...patch })
          : row
      );
    });

    setPoles((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const value = useMemo(
    () => ({
      env: CONTEXT_ENV,
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
      operator: operator
        ? {
            ...operator,
            initials: getInitials(operator?.name),
          }
        : null,
      setOperator,
      signOut,
    }),
    [
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
      operator,
      setOperator,
      signOut,
    ]
  );

  return <LightWiseContext.Provider value={value}>{children}</LightWiseContext.Provider>;
}
