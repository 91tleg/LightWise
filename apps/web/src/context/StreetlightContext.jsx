import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { listStreetlights } from "../services/api";
import { normalizeStreetlightFromApi } from "../utils/poleHelpers";
import { mergePoleSnapshot, snapshotFromWsMessage } from "../utils/poleState";
import { AuthContext } from "./AuthContext";
import { WSContext } from "./WSContext";

export const StreetlightContext = createContext(null);

export function StreetlightProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { wsStatus, lastMessage } = useContext(WSContext);
  const [streetlights, setStreetlights] = useState([]);
  const hasLoadedOnceRef = useRef(false);
  const prevWsStatusRef = useRef("idle");

  const refreshStreetlights = useCallback(async () => {
    if (!isAuthenticated) {
      setStreetlights([]);
      return;
    }

    try {
      const raw = await listStreetlights();
      const rows = (Array.isArray(raw) ? raw : []).map(normalizeStreetlightFromApi);
      setStreetlights(rows);
    } finally {
      hasLoadedOnceRef.current = true;
    }
  }, [isAuthenticated]);

  const applyStreetlightLocalPatch = useCallback((streetlightId, patch = {}) => {
    const id = String(streetlightId || "").trim();
    if (!id) return;

    setStreetlights((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const exists = list.some((row) => row.streetlight_id === id);

      if (!exists) {
        return [normalizeStreetlightFromApi({ streetlight_id: id, ...patch }), ...list];
      }

      return list.map((row) =>
        row.streetlight_id === id
          ? normalizeStreetlightFromApi({ ...row, ...patch })
          : row
      );
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedOnceRef.current = false;
      prevWsStatusRef.current = "idle";
      setStreetlights([]);
      return;
    }
    refreshStreetlights();
  }, [isAuthenticated, refreshStreetlights]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const prev = prevWsStatusRef.current;
    if (
      hasLoadedOnceRef.current &&
      wsStatus === "connected" &&
      (prev === "disconnected" || prev === "error")
    ) {
      refreshStreetlights();
    }
    prevWsStatusRef.current = wsStatus;
  }, [isAuthenticated, wsStatus, refreshStreetlights]);

  useEffect(() => {
    if (!isAuthenticated || !lastMessage || typeof lastMessage !== "object") return;

    const streetlightId = String(lastMessage?.streetlight_id || "").trim();
    if (!streetlightId) return;

    setStreetlights((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const index = list.findIndex((row) => row.streetlight_id === streetlightId);
      const snapshot = snapshotFromWsMessage(lastMessage);

      if (index === -1) {
        return [
          mergePoleSnapshot(
            normalizeStreetlightFromApi({ streetlight_id: streetlightId }),
            snapshot
          ),
          ...list,
        ];
      }

      return list.map((row) =>
        row.streetlight_id === streetlightId ? mergePoleSnapshot(row, snapshot) : row
      );
    });
  }, [isAuthenticated, lastMessage]);

  const value = { streetlights, refreshStreetlights, applyStreetlightLocalPatch };

  return (
    <StreetlightContext.Provider value={value}>{children}</StreetlightContext.Provider>
  );
}
