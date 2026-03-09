import React, { useMemo } from "react";
import UiIcon from "./UiIcon";

function formatTime(ts) {
  if (!ts) return "Now";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

export default function ActivityFeed({ events = [], wsStatus, maxItems = 12 }) {
  const rows = useMemo(
    () => (Array.isArray(events) ? events.slice(0, maxItems) : []),
    [events, maxItems]
  );
  const connected = wsStatus === "connected";

  return (
    <div className="lwActivityFeed">
      <div className="lwActivityHeader lwActivityHeaderClean">
        <div className="lwActivityHeaderTitle">Live Events</div>
        <span className={`lwStatusDot ${connected ? "connected" : "idle"}`} aria-hidden="true" />
      </div>

      {!rows.length ? (
        <div className="lwActivityEmpty">No recent activity.</div>
      ) : (
        <div className="lwActivityList">
          {rows.map((e, idx) => (
            <div
              key={e.id ?? `${e.type}-${e.timestamp}-${idx}`}
              className="lwActivityItem lwActivityItemClean"
            >
              <div className="lwActivityTop">
                <span className="lwActivityTag">
                  <UiIcon name="activity" size={14} />
                  <span>{e.label || e.type || "Update"}</span>
                </span>
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