import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import MapEmbed from "../components/MapEmbed";
import Legend from "../components/Legend";
import Panel from "../components/Panel";
import Card from "../components/Card";
import PillRow from "../components/PillRow";
import { getTelemetry } from "../services/api";

export default function Overview() {
  const [telemetry, setTelemetry] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTelemetry()
      .then(setTelemetry)
      .catch((e) => setError(e?.message || String(e)));
  }, []);

  const poleId = telemetry?.poleId ?? "LW-001";

  const kpis = [
    { icon: "✅", label: "System Status", value: "N/A", note: "Demo mode" },
    { icon: "⚠️", label: "Faults Detected", value: "N/A", note: "Last 24h" },
    { icon: "♻️", label: "Energy Savings", value: "N/A kWh", note: "Today" },
    { icon: "📡", label: "Active Poles", value: "N/A", note: "Online" },
  ];

  return (
    <Layout
      title="Overview"
      subtitle="System health, alerts, and a quick view of the network."
    >
      {error && <div className="lwErrorBanner">API Error: {error}</div>}

      <div className="lwKpiGrid">
        {kpis.map(({ icon, label, value, note }) => (
          <StatCard
            key={label}
            icon={icon}
            label={label}
            value={value}
            note={note}
          />
        ))}
      </div>

      <div className="lwPanelGrid">
        <Panel title="Recent Alerts">
          <ul className="lwList">
            {["N/A", "N/A", "N/A"].map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Energy Trend">
          <div className="lwPlaceholder">N/A</div>
        </Panel>

        <Panel title="Operations">
          <PillRow
            pills={[
              { label: "Normal", color: "green" },
              { label: "Investigating", color: "orange" },
              { label: "Fault", color: "red" },
            ]}
          />
          <div className="lwSmallText" style={{ marginTop: 10 }}>
            Latest pole: <b>{poleId}</b>
          </div>
        </Panel>
      </div>

      <div className="lwBottomGrid">
        <Card title="Selected Lightpole">
          <div className="lwPoleRow">
            <div className="lwPoleAvatar" />
            <div className="lwPoleMeta">
              <div><b>ID:</b> {poleId}</div>
              <div><b>Lux:</b> {telemetry?.ambientLux ?? "N/A"}</div>
              <div><b>Motion:</b> {telemetry?.motion ?? "N/A"}</div>
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
