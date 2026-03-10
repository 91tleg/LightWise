import React from "react";
import UiIcon from "./UiIcon";
import { formatTimestamp } from "../utils/formatters";

function getEventTone(event) {
  const text = `${event?.label || ""} ${event?.note || ""}`.toLowerCase();

  if (text.includes("critical") || text.includes("fault")) return "critical";
  if (text.includes("warning") || text.includes("degraded")) return "warning";
  if (text.includes("motion detected")) return "warning";
  if (text.includes("motion cleared")) return "healthy";
  if (text.includes("connected")) return "healthy";
  return "neutral";
}

function getEventIcon(event) {
  const text = `${event?.label || ""} ${event?.note || ""}`.toLowerCase();

  if (text.includes("motion")) return "activity";
  if (text.includes("health") || text.includes("fault") || text.includes("warning")) return "alert";
  if (text.includes("brightness") || text.includes("light")) return "bolt";
  if (text.includes("connected") || text.includes("offline")) return "radio";
  return "activity";
}

function getReadableValue(event) {
  if (!event) return "";
  if (event.value && String(event.value).trim()) return event.value;
  return "";
}

function getReadableLabel(event) {
  if (!event?.label) return "System event";
  return event.label;
}

export default function ActivityFeed({
  events = [],
  wsStatus = "idle",
  maxItems = 6,
}) {
  const items = Array.isArray(events) ? events.slice(0, maxItems) : [];
  const feedStatus =
    wsStatus === "connected"
      ? "Live"
      : wsStatus === "connecting"
      ? "Connecting"
      : "Offline";

  return (
    <div className="lwActivityFeed">
      <div className="lwActivityFeedHeader">
        <div className="lwActivityFeedTitleRow">
          <span className={`lwActivityFeedStatus ${wsStatus}`}>{feedStatus}</span>
          <span className="lwActivityFeedHint">
            {items.length ? `${items.length} recent event${items.length === 1 ? "" : "s"}` : "No recent events"}
          </span>
        </div>
      </div>

      {!items.length ? (
        <div className="lwActivityEmpty">
          <div className="lwActivityEmptyIcon">
            <UiIcon name="activity" size={18} />
          </div>
          <div>
            <div className="lwActivityEmptyTitle">No recent activity</div>
            <div className="lwActivityEmptySub">New streetlight updates will appear here.</div>
          </div>
        </div>
      ) : (
        <div className="lwActivityList">
          {items.map((event) => {
            const tone = getEventTone(event);
            const icon = getEventIcon(event);
            const value = getReadableValue(event);

            return (
              <div key={event.id} className={`lwActivityItem ${tone}`}>
                <div className={`lwActivityIcon ${tone}`}>
                  <UiIcon name={icon} size={15} />
                </div>

                <div className="lwActivityMain">
                  <div className="lwActivityTopRow">
                    <div className="lwActivityLabel">{getReadableLabel(event)}</div>
                    <div className="lwActivityTime">
                      {formatTimestamp(event.timestamp)}
                    </div>
                  </div>

                  <div className="lwActivityMetaRow">
                    <span className="lwActivityPole">
                      {event.streetlightId || "Unknown pole"}
                    </span>

                    {value ? (
                      <span className={`lwActivityValue ${tone}`}>{value}</span>
                    ) : null}
                  </div>

                  {event.note ? (
                    <div className="lwActivityNote">{event.note}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}