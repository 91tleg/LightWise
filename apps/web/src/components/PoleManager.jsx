import React, { useEffect, useMemo, useState } from "react";

/**
 * PoleManager
 * - Allows adding "virtual poles" (lat/lng + name)
 * - Validates ranges
 * - Saves to localStorage so it persists across refresh
 */
export default function PoleManager({ onPolesChange }) {
  const STORAGE_KEY = "lightwise_poles_v1";

  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState("");
  const [poles, setPoles] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPoles(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(poles));
    } catch {
      // ignore
    }
    if (typeof onPolesChange === "function") onPolesChange(poles);
  }, [poles, onPolesChange]);

  const validate = () => {
    setError("");

    const n = name.trim();
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!n) return "Pole name is required.";
    if (lat === "" || lng === "") return "Latitude and longitude are required.";
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return "Latitude/Longitude must be valid numbers.";
    if (latNum < -90 || latNum > 90) return "Latitude must be between -90 and 90.";
    if (lngNum < -180 || lngNum > 180) return "Longitude must be between -180 and 180.";

    return "";
  };

  const addPole = () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }

    const newPole = {
      id: `pole_${Date.now()}`,
      name: name.trim(),
      lat: Number(lat),
      lng: Number(lng),
      lastEvent: null,
    };

    setPoles((prev) => [newPole, ...prev]);
    setName("");
    setLat("");
    setLng("");
    setError("");
  };

  const removePole = (id) => setPoles((prev) => prev.filter((p) => p.id !== id));

  const clearAll = () => {
    if (!window.confirm("Clear all poles?")) return;
    setPoles([]);
  };

  const rows = useMemo(() => poles, [poles]);

  return (
    <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <h2 style={{ marginTop: 0 }}>Virtual Light Poles</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Pole Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pole A (Parking Lot)"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Latitude</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="47.6101"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Longitude</label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-122.2015"
            style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #d1d5db" }}
          />
        </div>

        <button
          onClick={addPole}
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
          Add Pole
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fee2e2", color: "#7f1d1d" }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>{rows.length} pole(s)</div>
        <button
          onClick={clearAll}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
        >
          Clear All
        </button>
      </div>

      <div style={{ marginTop: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Name</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Lat</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Lng</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}>Last Event</th>
              <th style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{p.name}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{p.lat.toFixed(5)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>{p.lng.toFixed(5)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  {p.lastEvent ? `${p.lastEvent.type} @ ${new Date(p.lastEvent.timestamp).toLocaleString()}` : "—"}
                </td>
                <td style={{ padding: 10, borderBottom: "1px solid #f3f4f6" }}>
                  <button
                    onClick={() => removePole(p.id)}
                    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 14, opacity: 0.7 }}>
                  No poles yet. Add one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
