import { useEffect, useState } from "react";
import { buildPoleEvent, snapshotFromWsMessage } from "../utils/poleState";

function isDuplicateEvent(first, nextEvent) {
  if (!first) return false;

  return (
    first.label === nextEvent.label &&
    first.streetlightId === nextEvent.streetlightId &&
    first.value === nextEvent.value &&
    first.note === nextEvent.note &&
    Math.abs(new Date(first.timestamp).getTime() - new Date(nextEvent.timestamp).getTime()) <
      15000
  );
}

export function useWebSocketSync(lastMessage) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== "object") return;

    const poleId = String(lastMessage?.streetlight_id || "").trim();
    if (!poleId) return;

    const snapshot = snapshotFromWsMessage(lastMessage);
    if (!snapshot) return;

    const nextEvent = buildPoleEvent(
      poleId,
      snapshot,
      lastMessage?.timestamp || new Date().toISOString()
    );

    setEvents((prev) => {
      if (isDuplicateEvent(prev[0], nextEvent)) return prev;
      return [nextEvent, ...prev].slice(0, 12);
    });
  }, [lastMessage]);

  return { events };
}
