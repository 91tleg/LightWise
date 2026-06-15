import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { getOperatorProfile } from "../services/api";
import {
  hasSignedOutSession,
  subscribeToAuthRequired,
  redirectToSignIn,
  redirectToSignOut,
  refreshTokens,
  startTokenRefresh,
  stopTokenRefresh,
} from "../services/auth";

export const AuthContext = createContext(null);

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AuthProvider({ children }) {
  const [operator, setOperator]   = useState(null);
  const [authStatus, setAuthStatus] = useState("idle");
  const [authError, setAuthError]  = useState(null);

  const inflightRef  = useRef(null);
  const operatorRef  = useRef(null);

  const clearAuth = useCallback(() => {
    stopTokenRefresh();
    operatorRef.current = null;
    setOperator(null);
    setAuthStatus("unauthenticated");
    setAuthError(null);
  }, []);

  useEffect(() => subscribeToAuthRequired(clearAuth), [clearAuth]);

  const loadProfile = useCallback(async ({ force = false, skipRefresh = false } = {}) => {
    if (!force && operatorRef.current) {
      setAuthStatus("authenticated");
      return operatorRef.current;
    }
    if (!force && inflightRef.current) return inflightRef.current;

    const promise = (async () => {
      setAuthStatus("loading");
      setAuthError(null);
      if (!force && hasSignedOutSession()) {
        clearAuth();
        return null;
      }

      if (!skipRefresh) {
        try {
          await refreshTokens({ emitOnFailure: false });
        } catch (err) {
          if (!force && (err?.status === 401 || err?.status === 403)) {
            clearAuth();
            return null;
          }
        }
      }

      try {
        const profile = await getOperatorProfile();
        operatorRef.current = profile;
        setOperator(profile);
        setAuthStatus("authenticated");
        startTokenRefresh();
        return profile;
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) { clearAuth(); return null; }
        setAuthStatus("error");
        setAuthError(err);
        throw err;
      }
    })().finally(() => {
      if (inflightRef.current === promise) inflightRef.current = null;
    });

    inflightRef.current = promise;
    return promise;
  }, [clearAuth]);

  const completeAuthentication = useCallback(async () => {
    return loadProfile({ force: true, skipRefresh: true });
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    clearAuth();
    await redirectToSignOut();
  }, [clearAuth]);

  return (
    <AuthContext.Provider value={{
      operator: operator ? { ...operator, initials: getInitials(operator.name) } : null,
      authStatus,
      authError,
      isAuthenticated: authStatus === "authenticated" && Boolean(operator),
      ensureAuthenticated: loadProfile,
      completeAuthentication,
      redirectToSignIn,
      clearAuth,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
