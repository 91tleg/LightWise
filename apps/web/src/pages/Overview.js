import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import MapEmbed from "../components/MapEmbed";
import Legend from "../components/Legend";
import { getTelemetry } from "../services/api";

export default function Overview() {

  // ===== STATE BLOCK =====
  // telemetry stores the data received from the backend API.
  // error stores any error message if the API call fails.
  const [telemetry, setTelemetry] = useState(null);
  const [error, setError] = useState("");

  // ===== DATA FETCH BLOCK =====
  // This runs once when the page loads.
  // It calls the API to get telemetry data and saves it in state.
  // The "alive" flag prevents updating state if the page is unmounted.
  useEffect(() => {
    let alive = true;

    getTelemetry()
      .then((data) => alive && setTelemetry(data))
      .catch((e) => alive && setError(String(e?.message || e)));

    return () => {
      alive = false;
    };
  }, []);

  // ===== DERIVED VALUE BLOCK =====
  // This chooses which pole ID to display.
  // If telemetry data exists, use its poleId.
  // Otherwise, fall back to a default demo ID.
  const poleId = telemetry?.poleId || "LW-001";

  // ===== MAIN RETURN BLOCK =====
  // Everything inside return(...) is what will be drawn on the Overview page
  return (

    // This block wraps the Overview page inside the common Layout.
    // It sets the page title and subtitle.
    <Layout
      title="Overview"
      subtitle="System health, alerts, and a quick view of the network."
    >

      {/* 
        This block shows an error banner at the top of the page
        only if an API error occurred while loading telemetry data.
      */}
      {error ? <div className="lwErrorBanner">API Error: {error}</div> : null}

      {/* 
        This block is the KPI row at the top of the page.
        It displays several StatCard components with key system metrics.
      */}
      <div className="lwKpiGrid">
        <StatCard icon="✅" label="System Status" value="N/A" note="Demo mode" />
        <StatCard icon="⚠️" label="Faults Detected" value="N/A" note="Last 24h" />
        <StatCard icon="♻️" label="Energy Savings" value="N/A kWh" note="Today" />
        <StatCard icon="📡" label="Active Poles" value="N/A" note="Online" />
      </div>

      {/* 
        This block is the main panel grid in the middle of the page.
        It contains three panels: Alerts, Energy Trend, and Operations.
      */}
      <div className="lwPanelGrid">

        {/* 
          This panel shows the list of recent alerts.
          For now, it only displays placeholder values.
        */}
        <section className="lwPanel">
          <div className="lwPanelTitle">Recent Alerts</div>
          <div className="lwPanelBody">
            <ul className="lwList">
              <li>N/A</li>
              <li>N/A</li>
              <li>N/A</li>
            </ul>
          </div>
        </section>

        {/* 
          This panel shows the energy usage trend.
          For now, it only displays a placeholder.
        */}
        <section className="lwPanel">
          <div className="lwPanelTitle">Energy Trend</div>
          <div className="lwPanelBody">
            <div className="lwPlaceholder">N/A</div>
          </div>
        </section>

        {/* 
          This panel shows current operational status information.
          It displays status pills and the latest selected pole ID.
        */}
        <section className="lwPanel">
          <div className="lwPanelTitle">Operations</div>
          <div className="lwPanelBody">

            {/* This row shows different operation status labels */}
            <div className="lwPillRow">
              <span className="lwPill green">Normal</span>
              <span className="lwPill orange">Investigating</span>
              <span className="lwPill red">Fault</span>
            </div>

            {/* This block shows the most recent pole ID */}
            <div className="lwSmallText" style={{ marginTop: 10 }}>
              Latest pole: <b>{poleId}</b>
            </div>
          </div>
        </section>
      </div>

      {/* 
        This block is the bottom row of the Overview page.
        It shows selected pole details, a small map, and the legend.
      */}
      <div className="lwBottomGrid">

        {/* 
          This card shows details about the currently selected light pole.
          It displays the pole ID, ambient light value, and motion status.
        */}
        <section className="lwCard">
          <div className="lwCardTitle">Selected Lightpole</div>
          <div className="lwPoleRow">
            <div className="lwPoleAvatar" />
            <div className="lwPoleMeta">
              <div>
                <b>ID:</b> {poleId}
              </div>
              <div>
                <b>Lux:</b> {telemetry?.ambientLux ?? "N/A"}
              </div>
              <div>
                <b>Motion:</b> {telemetry?.motion ?? "N/A"}
              </div>
            </div>
          </div>
        </section>

        {/* 
          This card shows a small embedded map for quick location reference.
        */}
        <section className="lwCard">
          <div className="lwCardTitle">Map</div>
          <MapEmbed title="Bellevue College Area" height={300} />
        </section>

        {/* 
          This block shows the color legend explaining map and status colors.
        */}
        <Legend />
      </div>

    </Layout>
  );
}
