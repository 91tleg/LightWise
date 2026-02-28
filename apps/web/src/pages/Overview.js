import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import MapEmbed from "../components/MapEmbed";
import Legend from "../components/Legend";
import Panel from "../components/Panel";
import Card from "../components/Card";
import PillRow from "../components/PillRow";
import { listStreetlights } from "../services/api";

export default function Overview() {
  const [streetlights, setStreetlights] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listStreetlights()
      .then((rows) => setStreetlights(Array.isArray(rows) ? rows : []))
      .catch((e) => setError(e?.message || String(e)));
  }, []);

  const stats = useMemo(() => {
    const total = streetlights.length;

    const ok = streetlights.filter((s) => s.health === "OK").length;
    const degraded = streetlights.filter((s) => s.health === "DEGRADED").length;
    const critical = streetlights.filter((s) => s.health === "CRITICAL").length;

    const totalPoles = total;

    const alerts = streetlights
      .filter((s) => s.health === "DEGRADED" || s.health === "CRITICAL")
      .slice(0, 5);

    const selected = streetlights[0] || null;

    // Honest system status:
    // - If any critical -> CRITICAL
    // - Else if any degraded -> DEGRADED
    // - Else OK (if we have any poles)
    const systemStatus =
      critical > 0 ? "CRITICAL" : degraded > 0 ? "DEGRADED" : total > 0 ? "OK" : "N/A";

    return {
      total,
      ok,
      degraded,
      critical,
      totalPoles,
      systemStatus,
      alerts,
      selected,
    };
  }, [streetlights]);

  const selectedId = stats.selected?.streetlight_id ?? "—";

  const selectedMotion =
    typeof stats.selected?.motion_detected === "boolean"
      ? stats.selected.motion_detected
        ? "true"
        : "false"
      : "N/A";

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
      label: "Energy Savings",
      value: "N/A",
      note: "Not computed (needs meter/baseline)",
    },
    {
      icon: "📡",
      label: "Total Poles",
      value: String(stats.totalPoles || "0"),
      note: "From /streetlights",
    },
  ];

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
          <div className="lwPlaceholder">
            N/A (needs time-series energy data or computed savings model)
          </div>
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
        </Panel>
      </div>

      <div className="lwBottomGrid">
        <Card title="Selected Lightpole">
          <div className="lwPoleRow">
            <div className="lwPoleAvatar" />
            <div className="lwPoleMeta">
              <div>
                <b>ID:</b> {selectedId}
              </div>
              <div>
                <b>Name:</b> {stats.selected?.name ?? "N/A"}
              </div>
              <div>
                <b>Health:</b> {stats.selected?.health ?? "N/A"}
              </div>
              <div>
                <b>Motion:</b> {selectedMotion}
              </div>
              <div>
                <b>Last seen:</b> {stats.selected?.last_seen ?? "N/A"}
              </div>
              <div className="lwSmallText" style={{ marginTop: 8, opacity: 0.9 }}>
                Lux/Temp/Humidity/Light Level are WS telemetry fields (not available from
                `/streetlights` list response unless backend adds them there).
              </div>
            </div>
          </div>
        </Card>

        <Card title="Map">
          <MapEmbed title="Bellevue College Area" height={300} />
        </Card>

        <Legend />
      </div>
    </Layout>
  );
}