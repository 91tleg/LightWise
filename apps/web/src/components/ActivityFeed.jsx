import React, { useEffect, useMemo, useState } from "react";

/**
 * ActivityFeed
 *
 * Props:
 *  - wsStatus: string ("idle"|"connecting"|"connected"|"disconnected"|"error")
 *  - lastMessage: object|null  (latest message parsed from WS)
 *  - maxItems?: number (default 20)
 *
 * Message shape expected (but flexible):
 *  {
 *    type: "motion",
 *    poleId: "pole_demo",
 *    value: 1,
 *    timestamp: "2026-02-07T..."
 *  }
 */
export default function ActivityFeed({ wsStatus, lastMessage, maxItems = 20 }) {
  const [events, setEvents] = useState([]);

  // Add new incoming messages to the feed
  useEffect(() => {
    if (!lastMessage) return;

    setEvents((prev) => {
      const next = [normalizeEvent(lastMessage), ...prev];
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

    // simple status color-ish (still neutral)
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

  const clear = () => setEvents([]);

  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "white",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Live Activity</h3>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
            Incoming events from your AWS WebSocket broadcast.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statusBadge}
          <button
            onClick={clear}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {events.length === 0 ? (
          <div style={{ opacity: 0.7 }}>
            No events yet. Click <b>Simulate Motion</b> to broadcast an event.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Pole</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Raw</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.id || i}>
                    <td style={tdStyle}>{formatTime(e.timestamp)}</td>
                    <td style={tdStyle}><b>{e.type}</b></td>
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
  // msg might already be a good object, or might be { raw: "..." }
  const raw = msg;

  const type = safeStr(raw?.type, "event");
  const poleId = safeStr(raw?.poleId, safeStr(raw?.pole, "unknown_pole"));
  const value = raw?.value ?? raw?.reading ?? raw?.level ?? "";
  const timestamp = raw?.timestamp || raw?.time || new Date().toISOString();

  return {
    id: raw?.id || `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    poleId,
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
