// apps/web/src/context/LightWiseProvider.jsx

import React, { createContext, useEffect, useMemo, useCallback, useState } from "react";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { normalizeEvent } from "../utils/normalizeEvent";
import { loadPoles, savePoles } from "../services/poleStorage";

export const LightWiseContext = createContext(null);

export function LightWiseProvider({ children }) {
  // Support both env variable names (you currently use REACT_APP_LIGHTWISE_WS_URL in .env.local)
  const WS_URL =
    process.env.REACT_APP_LIGHTWISE_WS_URL ||
    process.env.REACT_APP_WS_URL ||
    "";

  // Poles = list of streetlight_id strings
  const [poles, setPoles] = useState(() => loadPoles());

  // Events = normalized objects for ActivityFeed
  const [events, setEvents] = useState([]);

  // WebSocket engine
  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useLightWiseWS(WS_URL, {
      debug: false,
      autoReconnect: true,
    });

  // Persist poles whenever they change
  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  // Auto-subscribe to all poles when connected
  useEffect(() => {
    if (wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [wsStatus, poles, subscribe]);

  // Convert incoming WS messages into events once (single pipeline)
  useEffect(() => {
    if (!lastMessage) return;

    const ev = normalizeEvent(lastMessage);
    if (!ev) return;

    setEvents((prev) => [ev, ...prev].slice(0, 200)); // cap feed size
  }, [lastMessage]);

  // Actions (these are what UI will call)
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

  const clearPoles = useCallback(() => {
    setPoles([]);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // Context value exposed to the app
  const value = useMemo(
    () => ({
      wsStatus,
      wsError,
      lastMessage,
      send,
      subscribe, // helpful if UI wants manual subscribe
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