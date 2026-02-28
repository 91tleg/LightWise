// LightWise/apps/web/src/components/ActivityFeed.jsx

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ActivityFeed
 *
 * Props:
 *  - wsStatus: string
 *  - lastMessage: object|null (latest WS message)
 *  - maxItems?: number (default 20)
 */
export default function ActivityFeed({ wsStatus, lastMessage, maxItems = 20 }) {
  const [events, setEvents] = useState([]);
  const lastSigRef = useRef(null);

  useEffect(() => {
    if (!lastMessage) return;

    const evt = normalizeEvent(lastMessage);
    const sig = evt.sig;

    if (sig && sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    setEvents((prev) => {
      const next = [evt, ...prev];
      return next.slice(0, maxItems);
    });
  }, [lastMessage, maxItems]);

  const header = useMemo(() => {
    if (wsStatus === "connected") return "Live Events (connected)";
    if (wsStatus === "connecting") return "Live Events (connecting...)";
    if (wsStatus === "error") return "Live Events (error)";
    return "Live Events";
  }, [wsStatus]);

  return (
    <div className="lwActivityFeed">
      <div className="lwActivityHeader">{header}</div>

      {!events.length ? (
        <div className="lwActivityEmpty">
          No events yet. (If WS is connected but nothing arrives, it usually means no telemetry is being published.)
        </div>
      ) : (
        <div className="lwActivityList">
          {events.map((e) => (
            <div key={e.id} className="lwActivityItem">
              <div className="lwActivityTop">
                <span className="lwActivityType">{e.type}</span>
                <span className="lwActivityTime">{formatTime(e.timestamp)}</span>
              </div>
              <div className="lwActivityMid">
                <span className="lwActivityPole">{e.streetlightId}</span>
                <span className="lwActivityVal">{String(e.value)}</span>
              </div>
              {e.note ? <div className="lwActivityNote">{e.note}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Normalization for BOTH old + new message styles ---
function normalizeEvent(msg) {
  const raw = msg;

  // Max telemetry push format:
  // { tenant_id, streetlight_id, timestamp, health, data{...}, diagnostics{...} }
  const streetlightId =
    safeStr(raw?.streetlight_id, "") ||
    safeStr(raw?.poleId ?? raw?.payload?.poleId ?? raw?.pole, "unknown");

  const ts = raw?.timestamp ?? raw?.time ?? raw?.payload?.timestamp ?? new Date().toISOString();

  const health = safeStr(raw?.health, "");
  const motion = raw?.data?.motion;
  const lightLevel = raw?.data?.light_level;

  // Choose a useful “type/value” for the feed
  let type = "telemetry";
  let value = "";

  if (typeof motion === "boolean") {
    type = "motion";
    value = motion ? "DETECTED" : "clear";
  } else if (typeof lightLevel === "number") {
    type = "light_level";
    value = `${lightLevel}%`;
  } else if (health) {
    type = "health";
    value = health;
  } else {
    // fallback for unknown shapes
    type = safeStr(raw?.type ?? raw?.payload?.type, "event");
    value = raw?.value ?? raw?.payload?.value ?? raw?.reading ?? raw?.level ?? "";
  }

  const noteParts = [];
  if (typeof raw?.data?.lux === "number") noteParts.push(`lux ${raw.data.lux}`);
  if (typeof raw?.data?.temp_c === "number") noteParts.push(`temp ${raw.data.temp_c}°C`);
  if (typeof raw?.data?.humidity === "number") noteParts.push(`humidity ${raw.data.humidity}%`);
  const note = noteParts.join(" • ");

  const sig = `${type}|${streetlightId}|${String(value)}|${String(ts)}`;

  return {
    id: raw?.id || sig,
    sig,
    type,
    streetlightId,
    value,
    timestamp: ts,
    note,
    raw,
  };
}

function safeStr(v, fallback) {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function formatTime(ts) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}