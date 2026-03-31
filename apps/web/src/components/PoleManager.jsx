// src/components/PoleManager.jsx
import React, { useMemo, useState } from "react";

/**
 * PoleManager (presentational)
 * Poles = array of streetlight_id strings (ex: ["LW-00100"])
 *
 * Props:
 *  - poles: string[]
 *  - onAdd: (streetlightId: string) => void
 *  - onRemove: (streetlightId: string) => void
 *  - onClearAll?: () => void
 */
export default function PoleManager({ poles = [], onAdd, onRemove, onClearAll }) {
  const [streetlightId, setStreetlightId] = useState("");
  const [error, setError] = useState("");

  const rows = useMemo(() => (Array.isArray(poles) ? poles : []), [poles]);

  const add = () => {
    setError("");
    const id = streetlightId.trim();
    if (!id) {
      setError("Streetlight ID is required (example: LW-00100).");
      return;
    }
    if (typeof onAdd === "function") onAdd(id);
    setStreetlightId("");
  };

  const clearAll = () => {
    if (!onClearAll) return;
    if (!window.confirm("Clear all tracked streetlights?")) return;
    onClearAll();
  };

  return (
    <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <h2 style={{ marginTop: 0 }}>Tracked Streetlights</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Streetlight ID</label>
          <input
            value={streetlightId}
            onChange={(e) => setStreetlightId(e.target.value)}
            placeholder="LW-00100"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </div>

        <button
          onClick={add}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            height: 42,
          }}
        >
          Add
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#7f1d1d" }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{rows.length} tracked</div>
        {onClearAll ? (
          <button
            onClick={clearAll}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
          >
            Clear All
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Streetlight ID</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((id) => (
              <tr key={id}>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{id}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  <button
                    onClick={() => (typeof onRemove === "function" ? onRemove(id) : null)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #d1d5db",
                      background: "white",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ padding: 14, opacity: 0.7 }}>
                  No tracked streetlights yet. Add one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
