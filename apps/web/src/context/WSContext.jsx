import { createContext, useContext, useEffect, useState } from "react";
import { LIGHTWISE_ENV } from "../config/env";
import { useWebSocket } from "../hooks/useWebSocket";
import { AuthContext } from "./AuthContext";

export const WSContext = createContext(null);

export function WSProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const [wsToken, setWsToken] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setWsToken(null);
      return;
    }

    let cancelled = false;

    fetch(`${process.env.REACT_APP_API_BASE}/auth/token`, {
      credentials: "include",
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (!cancelled) setWsToken(data.token); })
      .catch(() => { if (!cancelled) setWsToken(null); });

    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useWebSocket(isAuthenticated && wsToken ? LIGHTWISE_ENV.WS_URL : "", {
      debug: false,
      autoReconnect: true,
      getToken: wsToken ? () => wsToken : null,
    });

  const value = { wsStatus, wsError, lastMessage, send, subscribe };
  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}
