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
 *  - wsStatus: string ("idle"|"connecting"|"connected"|"disconnected"|"error")
 *  - lastMessage: object|null (latest message parsed from WS)
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
      if (sig && prev.some((p) => p.sig === sig)) return prev;
      const next = [evt, ...prev];
      return next.slice(0, maxItems);
    });
  }, [lastMessage, maxItems]);

  const statusBadge = useMemo(() => {
    const base = {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      border: "1px solid #d1d5db",
      background: "#fff",
      display: "inline-block",
    };

    const label = wsStatus || "idle";

    let borderColor = "#d1d5db";
    if (label === "connected") borderColor = "#16a34a";
    if (label === "connecting") borderColor = "#f59e0b";
    if (label === "error") borderColor = "#dc2626";
    if (label === "disconnected") borderColor = "#6b7280";

    return (
      <span style={{ ...base, borderColor }}>
        WS: <b>{label}</b>
      </span>
    );
  }, [wsStatus]);

  const rows = useMemo(() => (Array.isArray(events) ? events.slice(0, maxItems) : []), [events, maxItems]);

  return (
    <div className="lwActivityFeed">
      <div className="lwActivityHeader">{header}</div>
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "white",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Live Activity</h3>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Incoming events from your AWS WebSocket broadcast.
          </div>
        </div>

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

      <div style={{ marginTop: 14 }}>
        {events.length === 0 ? (
          <div style={{ opacity: 0.7 }}>
            No events yet. Click <b>Subscribe</b> (and/or wait for sensor uplinks).
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Streetlight</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Raw</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id || i}>
                    <td style={tdStyle}>{formatTime(e.timestamp)}</td>
                    <td style={tdStyle}>
                      <b>{e.type}</b>
                    </td>
                    <td style={tdStyle}>{e.poleId}</td>
                    <td style={tdStyle}>{String(e.value)}</td>
                    <td style={tdStyle}>
                      <details>
                        <summary style={{ cursor: "pointer" }}>view</summary>
                        <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>
                          {JSON.stringify(e.raw, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Optional: quick legend */}
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Tip: For telemetry, open <b>Raw</b> to see lux/temp/humidity/motion/diagnostics.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  opacity: 0.8,
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};

function normalizeEvent(msg) {
  const raw = msg;

  // Some backends might send a plain string like "subscribed"
  if (typeof raw === "string") {
    const type = raw.toLowerCase().includes("subscrib") ? "subscribe_ack" : "message";
    const timestamp = new Date().toISOString();
    const poleId = "N/A";
    const value = raw;

    const sig = `${type}|${poleId}|${String(value)}|${String(timestamp)}`;

    return {
      id: sig,
      sig,
      type,
      poleId,
      value,
      timestamp,
      raw,
    };
  }

  // ----- Max telemetry mapping -----
  const streetlightId =
    raw?.streetlight_id ||
    raw?.streetlightId ||
    raw?.device_id ||
    raw?.deviceId ||
    raw?.poleId ||
    raw?.payload?.streetlight_id ||
    raw?.payload?.device_id ||
    raw?.payload?.poleId ||
    "unknown_streetlight";

  const timestamp =
    raw?.timestamp ||
    raw?.time ||
    raw?.created_at ||
    raw?.payload?.timestamp ||
    new Date().toISOString();

  const hasTelemetryShape =
    raw &&
    (raw.streetlight_id || raw.tenant_id || raw.data || raw.diagnostics || raw.health);

  // Infer type:
  // - If telemetry contains data.motion => motion event
  // - If telemetry shape but no motion => telemetry
  // - Else fallback to existing demo structure
  let type = safeStr(raw?.type ?? raw?.payload?.type, "");
  if (!type) {
    if (hasTelemetryShape) {
      if (typeof raw?.data?.motion === "boolean") type = raw.data.motion ? "motion" : "telemetry";
      else type = "telemetry";
    } else if (raw?.message) {
      type = "message";
    } else {
      type = "event";
    }
  }

  // Value:
  // - For motion => 1/0
  // - Else if health exists => health string
  // - Else fallback to old fields
  let value =
    raw?.value ??
    raw?.payload?.value ??
    raw?.reading ??
    raw?.level ??
    "";

  if (type === "motion" && typeof raw?.data?.motion === "boolean") {
    value = raw.data.motion ? 1 : 0;
  } else if (value === "" && typeof raw?.health === "string") {
    value = raw.health;
  } else if (value === "" && typeof raw?.message === "string") {
    value = raw.message;
  }

  // Stable signature: reduces duplicates
  const sig = `${type}|${streetlightId}|${String(value)}|${String(timestamp)}`;

  return {
    id: raw?.id || sig,
    sig,
    type,
    poleId: streetlightId,
    value,
    timestamp,
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