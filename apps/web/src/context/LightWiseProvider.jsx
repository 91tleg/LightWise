// apps/web/src/context/LightWiseProvider.jsx

import React, { createContext, useEffect, useMemo, useCallback, useState } from "react";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { normalizeEvent } from "../utils/normalizeEvent";
import { loadPoles, savePoles } from "../services/poleStorage";

export const LightWiseContext = createContext(null);

export function LightWiseProvider({ children }) {
  // Prefer the standard name; fallback to legacy if present
  const WS_URL =
    process.env.REACT_APP_WS_URL ||
    process.env.REACT_APP_LIGHTWISE_WS_URL ||
    "";

  const [poles, setPoles] = useState(() => loadPoles());
  const [events, setEvents] = useState([]);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useLightWiseWS(WS_URL, {
      debug: false,
      autoReconnect: true,
      autoSubscribeOnOpen: false, // we subscribe once per pole below
    });

  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  // Auto-subscribe to all poles when connected
  useEffect(() => {
    if (wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [wsStatus, poles, subscribe]);

  // Convert incoming WS messages into ActivityFeed events
  useEffect(() => {
    if (!lastMessage) return;

    const ev = normalizeEvent(lastMessage);
    if (!ev) return;

    setEvents((prev) => [ev, ...prev].slice(0, 200));
  }, [lastMessage]);

  const addPole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;

    setPoles((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
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