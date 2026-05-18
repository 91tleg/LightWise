import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { savePoles } from "../services/poleStorage";
import { AuthContext } from "./AuthContext";
import { WSContext } from "./WSContext";
import { StreetlightContext } from "./StreetlightContext";

export const PoleContext = createContext(null);

export function PoleProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { wsStatus, subscribe } = useContext(WSContext);
  const { streetlights } = useContext(StreetlightContext);
  const fetchedPoleIds = useMemo(
    () =>
      (Array.isArray(streetlights) ? streetlights : [])
        .map((row) => String(row?.streetlight_id || "").trim())
        .filter(Boolean),
    [streetlights]
  );
  const [poles, setPoles] = useState([]);

  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  useEffect(() => {
    setPoles(fetchedPoleIds);
  }, [fetchedPoleIds]);

  useEffect(() => {
    if (isAuthenticated) return;
    setPoles([]);
  }, [isAuthenticated]);

  const fetchedPoleIdSet = useMemo(() => new Set(fetchedPoleIds), [fetchedPoleIds]);

  const addPole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id || !fetchedPoleIdSet.has(id)) return;
    setPoles((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [fetchedPoleIdSet]);

  const removePole = useCallback((streetlightId) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;
    setPoles((prev) => prev.filter((poleId) => poleId !== id));
  }, []);

  const clearPoles = useCallback(() => setPoles([]), []);

  useEffect(() => {
    if (!isAuthenticated || wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [isAuthenticated, wsStatus, poles, subscribe]);

  const value = { poles, addPole, removePole, clearPoles };

  return <PoleContext.Provider value={value}>{children}</PoleContext.Provider>;
}
