import { createContext, useContext } from "react";
import { LIGHTWISE_ENV } from "../config/env";
import { useWebSocket } from "../hooks/useWebSocket";
import { fetchIdToken } from "../services/auth";
import { AuthContext } from "./AuthContext";

export const WSContext = createContext(null);

export function WSProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);

  const { status: wsStatus, error: wsError, lastMessage, send, subscribe } =
    useWebSocket(isAuthenticated ? LIGHTWISE_ENV.WS_URL : "", {
      debug: false,
      autoReconnect: true,
      getToken: fetchIdToken,
    });

  const value = { wsStatus, wsError, lastMessage, send, subscribe };

  return <WSContext.Provider value={value}>{children}</WSContext.Provider>;
}
