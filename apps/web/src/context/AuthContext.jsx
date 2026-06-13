import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { getOperatorProfile } from "../services/api";
import {
  fetchIdTokenSilently,
  waitForIdToken,
  subscribeToAuthRequired,
  redirectToSignIn,
  redirectToSignOut,
} from "../services/auth";

export const AuthContext = createContext(null);

function getInitials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "OP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function AuthProvider({ children }) {
  const [operator, setOperator] = useState(null);
  const [authStatus, setAuthStatus] = useState("idle");
  const [authError, setAuthError] = useState(null);
  const inflightRef = useRef(null);

  const clearAuth = useCallback(() => {
    setOperator(null);
    setAuthStatus("unauthenticated");
    setAuthError(null);
  }, []);

  useEffect(() => subscribeToAuthRequired(clearAuth), [clearAuth]);

  const loadProfile = useCallback(async ({ token = "", force = false } = {}) => {
    if (!force && operator) { setAuthStatus("authenticated"); return operator; }
    if (!force && inflightRef.current) return inflightRef.current;

    const promise = (async () => {
      setAuthStatus("loading");
      setAuthError(null);

      const idToken = String(token || "").trim() || (await fetchIdTokenSilently());
      if (!idToken) { clearAuth(); return null; }

      try {
        const profile = await getOperatorProfile(idToken);
        setOperator(profile);
        setAuthStatus("authenticated");
        return profile;
      } catch (err) {
        if (err?.status === 401) { clearAuth(); return null; }
        setAuthStatus("error");
        setAuthError(err);
        throw err;
      }
    })().finally(() => {
      if (inflightRef.current === promise) inflightRef.current = null;
    });

    inflightRef.current = promise;
    return promise;
  }, [clearAuth, operator]);

  // Called from AuthCallback after OAuth redirect
  const completeAuthentication = useCallback(async () => {
    const token = await waitForIdToken();
    return loadProfile({ token, force: true });
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
