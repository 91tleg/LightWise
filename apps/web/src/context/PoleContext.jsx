import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadPoles, savePoles } from "../services/poleStorage";
import { AuthContext } from "./AuthContext";
import { WSContext } from "./WSContext";
import { StreetlightContext } from "./StreetlightContext";

export const PoleContext = createContext(null);

export function PoleProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { wsStatus, subscribe, lastMessage } = useContext(WSContext);
  const { streetlights } = useContext(StreetlightContext);
  const [poles, setPoles] = useState(() => loadPoles());

  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  // Sync poles from streetlights on load
  useEffect(() => {
    if (!streetlights.length) return;
    const ids = streetlights.map((r) => r.streetlight_id).filter(Boolean);
    setPoles((prev) => [...new Set([...(prev || []), ...ids])]);
  }, [streetlights]);

  // Subscribe to poles over WS
  useEffect(() => {
    if (!isAuthenticated || wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [isAuthenticated, wsStatus, poles, subscribe]);

  // Add new poles seen in WS messages
  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== "object") return;
    const streetlightId = String(lastMessage?.streetlight_id || "").trim();
    if (!streetlightId) return;
    setPoles((prev) => (prev.includes(streetlightId) ? prev : [...prev, streetlightId]));
  }, [lastMessage]);

  const addPole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;
    setPoles((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removePole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;
    setPoles((prev) => prev.filter((poleId) => poleId !== id));
  }, []);

  const clearPoles = useCallback(() => setPoles([]), []);

  const value = { poles, addPole, removePole, clearPoles };

  return <PoleContext.Provider value={value}>{children}</PoleContext.Provider>;
}
