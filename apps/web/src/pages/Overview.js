// apps/web/src/pages/Overview.js

import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import MapEmbed from "../components/MapEmbed";
import Legend from "../components/Legend";
import Panel from "../components/Panel";
import Card from "../components/Card";
import PillRow from "../components/PillRow";

import { listStreetlights, updateStreetlightMetadata } from "../services/api";
import { useLightWiseWS } from "../services/useLightWiseWS";

function clampPct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function MiniLineChart({ values = [], height = 120 }) {
  // simple SVG polyline chart without extra libs
  const w = 520;
  const h = height;

  const pts = useMemo(() => {
    const arr = (values || [])
      .filter((v) => Number.isFinite(Number(v)))
      .map(Number);
    if (arr.length < 2) return "";

    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const span = max - min || 1;

    return arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * (w - 20) + 10;
        const y = h - 10 - ((v - min) / span) * (h - 20);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values, w, h]);

  if (!pts) {
    return <div className="lwPlaceholder">Waiting for telemetry to plot…</div>;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.9"
      />
    </svg>
  );
}

function okFail(val) {
  if (val == null) return "N/A";
  return val ? "OK" : "FAIL";
}

function toNumberOrNull(x) {
  if (x === "" || x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

export default function Overview() {
  const tenantId = process.env.REACT_APP_TENANT_ID || "tenant-001";
  const WS_URL =
    process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || "";

  const [streetlights, setStreetlights] = useState([]);
  const [error, setError] = useState("");

  // Metadata editor UI state
  const [metaDraft, setMetaDraft] = useState({ name: "", lat: "", lng: "" });
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMsg, setMetaMsg] = useState("");

  // WS for trend data
  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    tenantId,
    debug: false,
  });

  // store last N light levels for selected pole (trend)
  const [lightTrend, setLightTrend] = useState([]);

  // track latest WS motion for selected pole (optional)
  const [wsMotion, setWsMotion] = useState(null);

  const refreshStreetlights = async () => {
    setError("");
    try {
      const rows = await listStreetlights();
      setStreetlights(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  useEffect(() => {
    refreshStreetlights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = streetlights.length;

    const ok = streetlights.filter((s) => s.health === "OK").length;
    const degraded = streetlights.filter((s) => s.health === "DEGRADED").length;
    const critical = streetlights.filter((s) => s.health === "CRITICAL").length;

    const alerts = streetlights
      .filter((s) => s.health === "DEGRADED" || s.health === "CRITICAL")
      .slice(0, 5);

    const selected = streetlights[0] || null;

    const systemStatus =
      critical > 0 ? "CRITICAL" : degraded > 0 ? "DEGRADED" : total > 0 ? "OK" : "N/A";

    return {
      total,
      ok,
      degraded,
      critical,
      systemStatus,
      alerts,
      selected,
    };
  }, [streetlights]);

  const selected = stats.selected;
  const selectedId = selected?.streetlight_id ?? "—";

  // keep metadata draft synced to selection (CI-safe deps)
  useEffect(() => {
    setMetaMsg("");
    setMetaDraft({
      name: selected?.name ?? "",
      lat: selected?.lat ?? "",
      lng: selected?.lng ?? "",
    });
    setWsMotion(null);
    setLightTrend([]);
  }, [selected]); // ✅ satisfies react-hooks/exhaustive-deps

  // Auto-subscribe to selected pole for trend
  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (!selected?.streetlight_id) return;
    subscribe(selected.streetlight_id);
  }, [wsStatus, selected, subscribe]);

  // Collect light_level for trend graph + motion
  useEffect(() => {
    const msg = lastMessage;
    if (!msg || typeof msg !== "object") return;
    if (msg.streetlight_id !== selected?.streetlight_id) return;

    // trend
    const lvl = msg?.data?.light_level;
    if (typeof lvl === "number") {
      setLightTrend((prev) => {
        const next = [...prev, clampPct(lvl)];
        return next.slice(-40); // last 40 points
      });
    }

    // motion
    const m = msg?.data?.motion;
    if (typeof m === "boolean") {
      setWsMotion(m);
    } else if (typeof m === "number") {
      setWsMotion(Boolean(m));
    }
  }, [lastMessage, selected]);

  // Selected Motion display (prefer WS if present; fall back to REST field)
  const selectedMotion = useMemo(() => {
    if (typeof wsMotion === "boolean") return wsMotion ? "true" : "false";
    if (typeof selected?.motion_detected === "boolean") {
      return selected.motion_detected ? "true" : "false";
    }
    return "N/A";
  }, [wsMotion, selected]);

  const kpis = [
    {
      icon:
        stats.systemStatus === "CRITICAL"
          ? "🟥"
          : stats.systemStatus === "DEGRADED"
          ? "🟧"
          : "✅",
      label: "System Status",
      value: stats.systemStatus,
      note: stats.total ? `${stats.total} poles` : "No data",
    },
    {
      icon: "⚠️",
      label: "Faults Detected",
      value: String(stats.degraded + stats.critical || "0"),
      note: "DEGRADED + CRITICAL",
    },
    {
      icon: "♻️",
      label: "Energy Trend",
      value: wsStatus === "connected" ? "Live" : "N/A",
      note: "Brightness proxy from WS light_level",
    },
    {
      icon: "📡",
      label: "Total Poles",
      value: String(stats.total || "0"),
      note: "From /streetlights",
    },
  ];

  const lat = typeof selected?.lat === "number" ? selected.lat : null;
  const lng = typeof selected?.lng === "number" ? selected.lng : null;

  const onSaveMetadata = async () => {
    if (!selected?.streetlight_id) return;

    setMetaMsg("");
    setError("");
    setMetaSaving(true);

    try {
      const nextLat = toNumberOrNull(metaDraft.lat);
      const nextLng = toNumberOrNull(metaDraft.lng);

      if (metaDraft.lat !== "" && nextLat === null) {
        throw new Error("Lat must be a valid number (or blank).");
      }
      if (metaDraft.lng !== "" && nextLng === null) {
        throw new Error("Lng must be a valid number (or blank).");
      }

      const patch = {
        name: metaDraft.name,
        ...(metaDraft.lat === "" ? {} : { lat: nextLat }),
        ...(metaDraft.lng === "" ? {} : { lng: nextLng }),
      };

      await updateStreetlightMetadata(selected.streetlight_id, patch);

      setMetaMsg("Saved ✅");
      await refreshStreetlights();
    } catch (e) {
      const msg = e?.message || String(e);
      setMetaMsg("");
      setError(msg);
    } finally {
      setMetaSaving(false);
    }
  };

  return (
    <Layout title="Overview" subtitle="System health, alerts, and a quick view of the network.">
      {error && <div className="lwErrorBanner">API Error: {error}</div>}

      <div className="lwKpiGrid">
        {kpis.map(({ icon, label, value, note }) => (
          <StatCard key={label} icon={icon} label={label} value={value} note={note} />
        ))}
      </div>

      <div className="lwPanelGrid">
        <Panel title="Recent Alerts">
          {!stats.alerts.length ? (
            <div className="lwPlaceholder">No alerts (or no data)</div>
          ) : (
            <ul className="lwList">
              {stats.alerts.map((s) => (
                <li key={s.streetlight_id}>
                  <b>{s.streetlight_id}</b> — {s.health} — {s.name || "Unnamed"}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Energy Trend">
          <div className="lwSmallText" style={{ opacity: 0.85, marginBottom: 8 }}>
            This is a <b>brightness trend</b> from WS telemetry (<code>data.light_level</code>) — not metered kWh.
          </div>
          <MiniLineChart values={lightTrend} height={120} />
        </Panel>

        <Panel title="Operations">
          <PillRow
            pills={[
              { label: `OK: ${stats.ok}`, color: "green" },
              { label: `DEGRADED: ${stats.degraded}`, color: "orange" },
              { label: `CRITICAL: ${stats.critical}`, color: "red" },
            ]}
          />
          <div className="lwSmallText" style={{ marginTop: 10 }}>
            Latest pole: <b>{selectedId}</b>
          </div>
          <div className="lwSmallText" style={{ marginTop: 6, opacity: 0.85 }}>
            WS status: <b>{wsStatus}</b>
          </div>
        </Panel>
      </div>

      <div className="lwBottomGrid">
        <Card title="Selected Lightpole">
          <div className="lwPoleRow">
            <div className="lwPoleAvatar" />
            <div className="lwPoleMeta">
              <div><b>ID:</b> {selectedId}</div>
              <div><b>Tenant:</b> {selected?.tenant_id ?? "N/A"}</div>
              <div><b>Name:</b> {selected?.name ?? "N/A"}</div>
              <div><b>Health:</b> {selected?.health ?? "N/A"}</div>
              <div><b>Lat:</b> {selected?.lat ?? "N/A"}</div>
              <div><b>Lng:</b> {selected?.lng ?? "N/A"}</div>
              <div><b>Motion:</b> {selectedMotion}</div>
              <div><b>Last seen:</b> {selected?.last_seen ?? "N/A"}</div>

              <div><b>Ambient Primary:</b> {okFail(selected?.ambient_primary_ok)}</div>
              <div><b>Ambient Secondary:</b> {okFail(selected?.ambient_secondary_ok)}</div>
              <div><b>Temp/Humidity:</b> {okFail(selected?.th_ok)}</div>
              <div><b>Motion Primary:</b> {okFail(selected?.motion_primary_ok)}</div>
              <div><b>Motion Secondary:</b> {okFail(selected?.motion_secondary_ok)}</div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Edit Metadata</div>

                <div style={{ display: "grid", gap: 8, maxWidth: 340 }}>
                  <label>
                    <div className="lwSmallText" style={{ opacity: 0.85 }}>Name</div>
                    <input
                      value={metaDraft.name}
                      onChange={(e) => setMetaDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="BC Demo Pole"
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label>
                    <div className="lwSmallText" style={{ opacity: 0.85 }}>Lat</div>
                    <input
                      value={metaDraft.lat}
                      onChange={(e) => setMetaDraft((d) => ({ ...d, lat: e.target.value }))}
                      placeholder="47.6101"
                      style={{ width: "100%" }}
                    />
                  </label>

                  <label>
                    <div className="lwSmallText" style={{ opacity: 0.85 }}>Lng</div>
                    <input
                      value={metaDraft.lng}
                      onChange={(e) => setMetaDraft((d) => ({ ...d, lng: e.target.value }))}
                      placeholder="-122.2015"
                      style={{ width: "100%" }}
                    />
                  </label>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={onSaveMetadata} disabled={!selected?.streetlight_id || metaSaving}>
                      {metaSaving ? "Saving..." : "Save metadata"}
                    </button>
                    {metaMsg && <div className="lwSmallText" style={{ opacity: 0.9 }}>{metaMsg}</div>}
                  </div>

                  <div className="lwSmallText" style={{ opacity: 0.85 }}>
                    This calls <code>PUT /streetlights/&lt;id&gt;/metadata</code>.
                  </div>
                </div>
              </div>

              <div className="lwSmallText" style={{ marginTop: 10, opacity: 0.85 }}>
                Tip: if WS motion feels “stuck”, it updates only when telemetry pushes from the device.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Map">
          <MapEmbed title="Selected pole pin" height={300} lat={lat} lng={lng} zoom={17} />
        </Card>

        <Legend />
      </div>
    </Layout>
  );
}