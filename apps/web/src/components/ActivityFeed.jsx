// src/components/ActivityFeed.jsx

import React, { useMemo } from "react";

/**
 * Presentational ActivityFeed
 *
 * Props:
 *  - events: array of normalized events
 *  - wsStatus?: string
 *  - maxItems?: number
 */
export default function ActivityFeed({ events = [], wsStatus, maxItems = 20 }) {
  const header = useMemo(() => {
    if (wsStatus === "connected") return "Live Events (connected)";
    if (wsStatus === "connecting") return "Live Events (connecting...)";
    if (wsStatus === "error") return "Live Events (error)";
    return "Live Events";
  }, [wsStatus]);

  const rows = useMemo(() => (Array.isArray(events) ? events.slice(0, maxItems) : []), [events, maxItems]);

  return (
    <div className="lwActivityFeed">
      <div className="lwActivityHeader">{header}</div>

      {!rows.length ? (
        <div className="lwActivityEmpty">
          No events yet. (If WS is connected but nothing arrives, it usually means no telemetry is being published.)
        </div>
      ) : (
        <div className="lwActivityList">
          {rows.map((e) => (
            <div key={e.id} className="lwActivityItem">
              <div className="lwActivityTop">
                <span className="lwActivityType">{e.type}</span>
                <span className="lwActivityTime">{formatTime(e.timestamp)}</span>
              </div>
              <div className="lwActivityMid">
                <span className="lwActivityPole">{e.streetlightId || "—"}</span>
                <span className="lwActivityVal">{String(e.value ?? "")}</span>
              </div>
              {e.note ? <div className="lwActivityNote">{e.note}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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