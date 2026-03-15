import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getOperatorProfile, listStreetlights } from "../services/api";
import { CONTEXT_ENV, LIGHTWISE_ENV } from "../config/env";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { loadPoles, savePoles } from "../services/poleStorage";
import {
  fetchAccessToken,
  redirectToHostedLogin,
  signOutFromHostedUi,
  subscribeToAuthRequired,
  waitForAccessToken,
} from "../services/authSession";
import { normalizeEvent } from "../utils/normalizeEvent";
import { normalizeStreetlightFromApi } from "../utils/poleHelpers";
import { mergePoleSnapshot, snapshotFromWsMessage } from "../utils/poleState";

export const LightWiseContext = createContext(null);

function clearLegacyAuthStorage() {
  try {
    sessionStorage.removeItem("lightwise_operator");
    sessionStorage.removeItem("lightwise_auth");
    localStorage.removeItem("lightwise_operator");
    localStorage.removeItem("lightwise_auth");
  } catch {}
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
  const [operator, setOperator] = useState(null);
  const [authStatus, setAuthStatus] = useState("idle");
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = authStatus === "authenticated" && Boolean(operator);
  const authRequestRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const prevWsStatusRef = useRef("idle");

  useEffect(() => {
    clearLegacyAuthStorage();

    return subscribeToAuthRequired(() => {
      setOperator(null);
      setAuthStatus("unauthenticated");
      setAuthError(null);
      setStreetlights([]);
      setEvents([]);
      hasLoadedOnceRef.current = false;
      prevWsStatusRef.current = "idle";
    });
  }, []);

  const clearAuthState = useCallback(() => {
    clearLegacyAuthStorage();
    setOperator(null);
    setAuthStatus("unauthenticated");
    setAuthError(null);
    setStreetlights([]);
    setEvents([]);
    hasLoadedOnceRef.current = false;
    prevWsStatusRef.current = "idle";
  }, []);

  const loadOperatorProfile = useCallback(
    async ({ accessToken = "", force = false } = {}) => {
      if (!force && operator) {
        setAuthStatus("authenticated");
        setAuthError(null);
        return operator;
      }

      if (!force && authRequestRef.current) {
        return authRequestRef.current;
      }

      let promise;
      promise = (async () => {
        setAuthStatus("loading");
        setAuthError(null);

        const token = String(accessToken || "").trim() || (await fetchAccessToken());
        if (!token) {
          clearAuthState();
          return null;
        }

        try {
          const profile = await getOperatorProfile(token);
          setOperator(profile);
          setAuthStatus("authenticated");
          return profile;
        } catch (error) {
          if (error?.status === 401) {
            clearAuthState();
            return null;
          }

          setOperator(null);
          setAuthStatus("error");
          setAuthError(error);
          throw error;
        }
      })().finally(() => {
        if (authRequestRef.current === promise) {
          authRequestRef.current = null;
        }
      });

      authRequestRef.current = promise;
      return promise;
    },
    [clearAuthState, operator]
  );

  const ensureAuthenticated = useCallback(
    async (options = {}) => loadOperatorProfile(options),
    [loadOperatorProfile]
  );

  const completeAuthentication = useCallback(async () => {
    const accessToken = await waitForAccessToken();
    return loadOperatorProfile({ accessToken, force: true });
  }, [loadOperatorProfile]);

  const redirectToSignIn = useCallback(async () => {
    clearAuthState();
    await redirectToHostedLogin();
  }, [clearAuthState]);

  const signOut = useCallback(async () => {
    clearAuthState();
    await signOutFromHostedUi();
  }, [clearAuthState]);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useLightWiseWS(isAuthenticated ? LIGHTWISE_ENV.WS_URL : "", {
      debug: false,
      autoReconnect: true,
    });

  useEffect(() => {
    savePoles(poles);
  }, [poles]);

  const refreshStreetlights = useCallback(async () => {
    if (!isAuthenticated) {
      setStreetlights([]);
      return;
    }

    try {
      const raw = await listStreetlights();
      const rows = (Array.isArray(raw) ? raw : []).map(normalizeStreetlightFromApi);

      setStreetlights(rows);

      if (rows.length) {
        const ids = rows.map((row) => row.streetlight_id).filter(Boolean);
        setPoles((prev) => [...new Set([...(prev || []), ...ids])]);
      }
    } finally {
      hasLoadedOnceRef.current = true;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasLoadedOnceRef.current = false;
      prevWsStatusRef.current = "idle";
      setStreetlights([]);
      setEvents([]);
      return;
    }

    refreshStreetlights();
  }, [isAuthenticated, refreshStreetlights]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const prev = prevWsStatusRef.current;

    if (
      hasLoadedOnceRef.current &&
      wsStatus === "connected" &&
      (prev === "disconnected" || prev === "error")
    ) {
      refreshStreetlights();
    }

    prevWsStatusRef.current = wsStatus;
  }, [isAuthenticated, refreshStreetlights, wsStatus]);

  useEffect(() => {
    if (!isAuthenticated || wsStatus !== "connected") return;
    poles.forEach((id) => subscribe(id));
  }, [isAuthenticated, poles, subscribe, wsStatus]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!lastMessage || typeof lastMessage !== "object") return;

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

    setPoles((prev) => (prev.includes(streetlightId) ? prev : [...prev, streetlightId]));

    const event = normalizeEvent(lastMessage);
    if (event) {
      setEvents((prev) => [event, ...prev].slice(0, 200));
    }
  }, [isAuthenticated, lastMessage]);

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
  const clearEvents = useCallback(() => setEvents([]), []);

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
      authStatus,
      authError,
      isAuthenticated,
      operator: operator
        ? {
            ...operator,
            initials: getInitials(operator?.name),
          }
        : null,
      setOperator,
      ensureAuthenticated,
      completeAuthentication,
      clearAuthState,
      redirectToSignIn,
      signOut,
    }),
    [
      addPole,
      applyStreetlightLocalPatch,
      authError,
      authStatus,
      clearAuthState,
      clearEvents,
      clearPoles,
      completeAuthentication,
      ensureAuthenticated,
      events,
      isAuthenticated,
      lastMessage,
      operator,
      poles,
      redirectToSignIn,
      refreshStreetlights,
      removePole,
      send,
      setOperator,
      signOut,
      streetlights,
      subscribe,
      wsError,
      wsStatus,
    ]
  );

  return <LightWiseContext.Provider value={value}>{children}</LightWiseContext.Provider>;
}
