import React, { createContext, useEffect, useMemo, useCallback, useState } from "react";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { normalizeEvent } from "../utils/normalizeEvent";
import { loadPoles, savePoles } from "../services/poleStorage";

export const LightWiseContext = createContext(null);

export function LightWiseProvider({ children }) {
  const WS_URL =
    (process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || "").trim();

  const API_BASE = (process.env.REACT_APP_API_BASE || "").trim();
  const TENANT_ID = (process.env.REACT_APP_TENANT_ID || "tenant-001").trim();
  const USE_MOCK = String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true";

  const [poles, setPoles] = useState(() => loadPoles());
  const [events, setEvents] = useState([]);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useLightWiseWS(WS_URL, {
      debug: false,
      autoReconnect: true,
    });

  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  useEffect(() => {
    if (wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [wsStatus, poles, subscribe]);

  useEffect(() => {
    if (!lastMessage) return;

    const ev = normalizeEvent(lastMessage);
    if (!ev) return;

    setEvents((prev) => [ev, ...prev].slice(0, 200));
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
      addPole,
      removePole,
      clearPoles,
      events,
      clearEvents,
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
      addPole,
      removePole,
      clearPoles,
      events,
      clearEvents,
    ]
  );

  return <LightWiseContext.Provider value={value}>{children}</LightWiseContext.Provider>;
}