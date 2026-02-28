// LightWise/apps/web/src/pages/Admin.js

import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import { useLightWiseWS } from "../services/useLightWiseWS";
import { listStreetlights } from "../services/api";

import "../styles/lightwise.css";
import "../styles/admin.css";

import adminBg from "../assets/background/adminBackground1.jpeg";

const WS_URL = process.env.REACT_APP_LIGHTWISE_WS_URL;

export default function Admin() {
  const tenantId = process.env.REACT_APP_TENANT_ID || "tenant-001";

  // Load streetlights
  const [streetlights, setStreetlights] = useState([]);
  const [selectedId, setSelectedId] = useState("LW-00042");
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    listStreetlights()
      .then((rows) => {
        setStreetlights(Array.isArray(rows) ? rows : []);
        const first = Array.isArray(rows) && rows[0]?.streetlight_id ? rows[0].streetlight_id : "LW-00042";
        setSelectedId((prev) => prev || first);
      })
      .catch((e) => setApiError(e?.message || String(e)));
  }, []);

  // WS
  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    tenantId,
    debug: false,
  });

  // Auto-subscribe when connected or when selected changes
  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (!selectedId) return;
    subscribe(selectedId);
  }, [wsStatus, selectedId, subscribe]);

  // Button flash state
  const [motionState, setMotionState] = useState("idle");

  const subscribeNow = () => {
    if (wsStatus !== "connected") {
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 900);
      return false;
    }
    setMotionState("simulating");
    const ok = subscribe(selectedId); // refresh subscribe
    setMotionState(ok ? "success" : "error");
    setTimeout(() => setMotionState("idle"), 900);
    return ok;
  };

  // Interpret live telemetry (Max format)
  const live = useMemo(() => {
    const msg = lastMessage;
    if (!msg || typeof msg !== "object") return null;

    // Only treat as telemetry if it has streetlight_id or data block
    if (!msg.streetlight_id && !msg.data) return null;

    return {
      streetlightId: msg.streetlight_id,
      health: msg.health,
      timestamp: msg.timestamp,
      lux: msg.data?.lux,
      tempC: msg.data?.temp_c,
      humidity: msg.data?.humidity,
      motion: msg.data?.motion,
      lightLevel: msg.data?.light_level,
      diagnostics: msg.diagnostics,
    };
  }, [lastMessage]);

  const selected = useMemo(() => {
    return streetlights.find((s) => s.streetlight_id === selectedId) || null;
  }, [streetlights, selectedId]);

  const lightPct =
    typeof live?.lightLevel === "number"
      ? Math.max(0, Math.min(100, live.lightLevel))
      : typeof selected?.light_level_pct === "number"
      ? Math.max(0, Math.min(100, selected.light_level_pct))
      : 0;

  const motionText =
    typeof live?.motion === "boolean"
      ? live.motion
        ? "MOTION DETECTED"
        : "no motion"
      : selected?.motion_detected
      ? "MOTION DETECTED"
      : "no motion";

  const healthText = live?.health || selected?.health || "—";

  return (
    <Layout
      title="Admin"
      subtitle="Live WebSocket telemetry + controls (demo)."
      backgroundImage={adminBg}
    >
      {apiError ? <div className="lwErrorBanner">API Error: {apiError}</div> : null}

      {/* Top Controls */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div className="lwInputGroup">
          <label className="lwLabel">Select Streetlight</label>
          <select
            className="lwSelect"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {streetlights.map((s) => (
              <option key={s.streetlight_id} value={s.streetlight_id}>
                {s.streetlight_id} — {s.name || "Unnamed"}
              </option>
            ))}
            {!streetlights.length ? (
              <option value="LW-00042">LW-00042 — (fallback)</option>
            ) : null}
          </select>
        </div>

        <AdminWsControls
          wsStatus={wsStatus}
          onSimulateMotion={subscribeNow}
          motionState={motionState}
        />
      </div>

      {/* Live Telemetry Card */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <BubbleCard
          icon="💡"
          title="Live Light State"
          sub={`WS: ${wsStatus} • Health: ${healthText}`}
          pills={[
            `Streetlight: ${selectedId}`,
            `Motion: ${motionText}`,
          ]}
        >
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>
              Brightness (light_level)
            </div>

            {/* Visual brightness bar */}
            <div style={{ height: 14, borderRadius: 999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${lightPct}%`,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.85)",
                  transition: "width 250ms ease",
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              {lightPct}% {typeof live?.lightLevel === "number" ? "(live)" : "(fallback)"}
            </div>

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              <div>Lux: {typeof live?.lux === "number" ? live.lux : "—"}</div>
              <div>Temp: {typeof live?.tempC === "number" ? `${live.tempC}°C` : "—"}</div>
              <div>Humidity: {typeof live?.humidity === "number" ? `${live.humidity}%` : "—"}</div>
              <div>Last seen: {live?.timestamp || selected?.last_seen || "—"}</div>
            </div>
          </div>
        </BubbleCard>

        <BubbleCard
          icon="📡"
          title="Diagnostics"
          sub="From server push (if provided)"
          pills={[
            `tenant: ${tenantId}`,
            `ambient_primary_ok: ${String(live?.diagnostics?.ambient_primary_ok ?? selected?.ambient_primary_ok ?? "—")}`,
            `ambient_secondary_ok: ${String(live?.diagnostics?.ambient_secondary_ok ?? selected?.ambient_secondary_ok ?? "—")}`,
            `th_ok: ${String(live?.diagnostics?.th_ok ?? selected?.th_ok ?? "—")}`,
          ]}
        >
          <div style={{ padding: 12, fontSize: 13, opacity: 0.95 }}>
            <div>overall_ok: {String(live?.diagnostics?.overall_ok ?? "—")}</div>
            <div>system_degraded: {String(live?.diagnostics?.system_degraded ?? "—")}</div>
            <div>motion_primary_ok: {String(live?.diagnostics?.motion_primary_ok ?? selected?.motion_primary_ok ?? "—")}</div>
            <div>motion_secondary_ok: {String(live?.diagnostics?.motion_secondary_ok ?? selected?.motion_secondary_ok ?? "—")}</div>
          </div>
        </BubbleCard>
      </div>

      {/* Activity feed */}
      <div style={{ marginTop: 14 }}>
        <ActivityFeed wsStatus={wsStatus} lastMessage={lastMessage} maxItems={20} />
      </div>
    </Layout>
  );
}