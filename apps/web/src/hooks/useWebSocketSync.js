import { useEffect, useState } from "react";
import {
  buildPoleEvent,
  mergeTelemetrySnapshot,
  snapshotFromWsMessage,
} from "../utils/poleState";

const EVENTS_CACHE_KEY = "lightwise_overview_events_cache_v6";

function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

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

export function useWebSocketSync(lastMessage, setSnapshotMap) {
  const [events, setEvents] = useState(() => readCache(EVENTS_CACHE_KEY, []));

  useEffect(() => {
    writeCache(EVENTS_CACHE_KEY, events);
  }, [events]);

  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== "object") return;

    const poleId = String(lastMessage?.streetlight_id || "").trim();
    if (!poleId) return;

    const snapshot = snapshotFromWsMessage(lastMessage);
    if (!snapshot) return;

    setSnapshotMap((prev) => ({
      ...prev,
      [poleId]: mergeTelemetrySnapshot(prev[poleId] || {}, snapshot),
    }));

    const nextEvent = buildPoleEvent(
      poleId,
      snapshot,
      lastMessage?.timestamp || new Date().toISOString()
    );

    setEvents((prev) => {
      if (isDuplicateEvent(prev[0], nextEvent)) return prev;
      return [nextEvent, ...prev].slice(0, 12);
    });
  }, [lastMessage, setSnapshotMap]);

  return { events };
}
