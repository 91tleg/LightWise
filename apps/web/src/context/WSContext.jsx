import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { LIGHTWISE_ENV } from "../config/env";
import { useWebSocket } from "../hooks/useWebSocket";
import { AuthContext } from "./AuthContext";

export const WSContext = createContext(null);

export function WSProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [wsToken, setWsToken] = useState(null);
  const wsTokenRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      wsTokenRef.current = null;
      setWsToken(null);
      return;
    }

    if (wsTokenRef.current) return; // already have a token

    let cancelled = false;

    fetch(`${process.env.REACT_APP_API_BASE}/auth/token`, {
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        if (!cancelled) {
          wsTokenRef.current = data.token;
          setWsToken(data.token);
        }
      })
      .catch(() => { if (!cancelled) setWsToken(null); });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const getToken = useCallback(() => wsTokenRef.current, []);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useWebSocket(isAuthenticated && wsToken ? LIGHTWISE_ENV.WS_URL : "", {
      debug: false,
      autoReconnect: true,
      getToken,
    });

  const value = { wsStatus, wsError, lastMessage, send, subscribe };
  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}
