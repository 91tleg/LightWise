import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { normalizeEvent } from "../utils/normalizers";
import { AuthContext } from "./AuthContext";
import { WSContext } from "./WSContext";

export const EventContext = createContext(null);

export function EventProvider({ children }) {
  const { isAuthenticated } = useContext(AuthContext);
  const { lastMessage } = useContext(WSContext);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEvents([]);
      return;
    }

    if (!lastMessage || typeof lastMessage !== "object") return;

    const event = normalizeEvent(lastMessage);
    if (event) {
      setEvents((prev) => [event, ...prev].slice(0, 200));
    }
  }, [isAuthenticated, lastMessage]);

  const clearEvents = useCallback(() => setEvents([]), []);

  const value = { events, clearEvents };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}
