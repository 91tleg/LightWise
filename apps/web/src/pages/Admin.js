// apps/web/src/pages/Admin.js

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

const WS_URL =
  process.env.REACT_APP_LIGHTWISE_WS_URL ||
  process.env.REACT_APP_WS_URL ||
  "";

export default function Admin() {
  const tenantId = process.env.REACT_APP_TENANT_ID || "tenant-001";

  const [streetlights, setStreetlights] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    listStreetlights()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setStreetlights(list);
        if (!selectedId) {
          const first = list[0]?.streetlight_id || "LW-00042";
          setSelectedId(first);
        }
      })
      .catch((e) => setApiError(e?.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    tenantId,
    debug: false,
  });

  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (!selectedId) return;
    subscribe(selectedId);
  }, [wsStatus, selectedId, subscribe]);

  const selected = useMemo(
    () => streetlights.find((s) => s.streetlight_id === selectedId) || null,
    [streetlights, selectedId]
  );

  const live = useMemo(() => {
    const msg = lastMessage;
    if (!msg || typeof msg !== "object") return null;
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

  const healthText = live?.health || selected?.health || "—";

  const motionText =
    typeof live?.motion === "boolean"
      ? live.motion
        ? "MOTION DETECTED"
        : "no motion"
      : typeof selected?.motion_detected === "boolean"
      ? selected.motion_detected
        ? "MOTION DETECTED"
        : "no motion"
      : "—";

  const lightPct =
    typeof live?.lightLevel === "number"
      ? clamp(live.lightLevel)
      : typeof selected?.light_level_pct === "number"
      ? clamp(selected.light_level_pct)
      : typeof selected?.current_light_level === "number"
      ? clamp(selected.current_light_level)
      : 0;

  const [btnState, setBtnState] = useState("idle");
  const resubscribe = () => {
    if (wsStatus !== "connected") {
      setBtnState("error");
      setTimeout(() => setBtnState("idle"), 800);
      return false;
    }
    setBtnState("simulating");
    const ok = subscribe(selectedId);
    setBtnState(ok ? "success" : "error");
    setTimeout(() => setBtnState("idle"), 800);
    return ok;
  };

  return (
    <div
      className="lwAdminPage"
      style={{
        backgroundImage: `url(${adminBg})`,
      }}
    >
      <div className="lwAdminPageOverlay">
        <Layout title="Admin" subtitle="System controls & configuration.">
          <AdminWsControls
            wsStatus={wsStatus}
            onSimulateMotion={simulateMotion}
            onSubscribeDemo={subscribeDemo}
            motionState={motionState}
          />

          <PoleManager />

          <ActivityFeed wsStatus={wsStatus} lastMessage={lastMessage} />

          <div className="lwBubbleGrid">
            <BubbleCard
              icon="🧠"
              title="Rules Engine"
              sub="Dimming + safety thresholds"
              pills={["Auto", "Night", "Motion"]}
              primaryLabel="Edit Rules"
              secondaryLabel="View Logs"
              onPrimary={() => alert("Edit Rules (demo)")}
              onSecondary={() => alert("View Logs (demo)")}
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

          <AdminWsControls wsStatus={wsStatus} onSimulateMotion={resubscribe} motionState={btnState} />
        </div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <BubbleCard
            icon="💡"
            title="Live Light State"
            sub={`WS: ${wsStatus} • Health: ${healthText}`}
            pills={[`Streetlight: ${selectedId || "—"}`, `Motion: ${motionText}`]}
          >
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Brightness (light_level)</div>

              <div style={{ height: 14, borderRadius: 999, background: "rgba(0,0,0,0.12)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${lightPct}%`,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.75)",
                    transition: "width 250ms ease",
                  }}
                />
              </div>

              <div style={{ marginTop: 8, fontSize: 14 }}>
                {lightPct}% {typeof live?.lightLevel === "number" ? "(live)" : "(backend/state)"}
              </div>
            </div>
          </BubbleCard>

          <BubbleCard
            icon="📡"
            title="Live Sensor Readings"
            sub={live ? "Latest telemetry received" : "Waiting for telemetry..."}
            pills={[`tenant: ${tenantId}`]}
          >
            <div style={{ padding: 12, fontSize: 13 }}>
              <div>Lux: {typeof live?.lux === "number" ? live.lux : "—"}</div>
              <div>Temp: {typeof live?.tempC === "number" ? `${live.tempC}°C` : "—°C"}</div>
              <div>Humidity: {typeof live?.humidity === "number" ? `${live.humidity}%` : "—%"}</div>
              <div>
                Diagnostics:{" "}
                {live?.diagnostics ? `overall_ok=${String(live.diagnostics.overall_ok)}` : "—"}
              </div>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                Last seen: {live?.timestamp || selected?.last_seen || "—"}
              </div>
            </div>
          </BubbleCard>
        </div>

        <div style={{ marginTop: 14 }}>
          <ActivityFeed wsStatus={wsStatus} lastMessage={lastMessage} maxItems={20} />
        </div>
      </div>
    </Layout>
  );
}

function clamp(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}