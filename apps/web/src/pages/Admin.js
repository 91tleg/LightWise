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

  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL, {
    tenantId,
    debug: false,
  });

  // Keep a small activity list for the ActivityFeed (presentational)
  const [events, setEvents] = useState([]);

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

  // Auto-subscribe on connect + whenever selected changes
  useEffect(() => {
    if (wsStatus !== "connected") return;
    if (!selectedId) return;
    subscribe(selectedId);
  }, [wsStatus, selectedId, subscribe]);

  // Convert WS messages into feed events
  useEffect(() => {
    if (!lastMessage) return;

    const evt = normalizeFeedEvent(lastMessage);
    if (!evt) return;

    setEvents((prev) => {
      // prevent spam duplicates (same type/id/timestamp)
      const sig = `${evt.type}|${evt.streetlightId}|${evt.timestamp}|${String(
        evt.value ?? ""
      )}`;

      if (
        prev.some(
          (p) =>
            `${p.type}|${p.streetlightId}|${p.timestamp}|${String(
              p.value ?? ""
            )}` === sig
        )
      ) {
        return prev;
      }

      return [evt, ...prev].slice(0, 50);
    });
  }, [lastMessage]);

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

  // Button flash state (AdminWsControls uses this)
  const [motionState, setMotionState] = useState("idle");

  // Frontend-only “simulate” to make demo feel alive
  const simulateMotion = () => {
    if (wsStatus !== "connected") {
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 900);
      return false;
    }

    setMotionState("simulating");

    const now = new Date().toISOString();
    const fake = {
      streetlight_id: selectedId || "LW-00042",
      timestamp: now,
      health: "OK",
      data: {
        motion: true,
        light_level: Math.min(
          100,
          Math.max(0, 70 + Math.round(Math.random() * 30))
        ),
        lux: Math.round(Math.random() * 3000) / 10,
        temp_c: 25,
        humidity: 60,
      },
    };

    // Push into feed instantly
    const evt = normalizeFeedEvent(fake);
    if (evt) {
      setEvents((prev) => [evt, ...prev].slice(0, 50));
    }

    setMotionState("success");
    setTimeout(() => setMotionState("idle"), 900);
    return true;
  };

  const subscribeDemo = (streetlightId) => {
    if (wsStatus !== "connected") return false;
    if (!streetlightId) return false;
    return subscribe(streetlightId);
  };

  return (
    <div
      className="lwAdminPage"
      style={{ backgroundImage: `url(${adminBg})` }}
    >
      <div className="lwAdminPageOverlay">
        <Layout title="Admin" subtitle="System controls & configuration.">
          <AdminWsControls
            wsStatus={wsStatus}
            onSimulateMotion={simulateMotion}
            onSubscribeDemo={subscribeDemo}
            motionState={motionState}
          />

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
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10 }}
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

              {apiError ? (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: "#b91c1c",
                  }}
                >
                  API error: {apiError}
                </div>
              ) : null}
            </BubbleCard>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <BubbleCard
              icon="💡"
              title="Live Light State"
              sub={`WS: ${wsStatus} • Health: ${healthText}`}
              pills={[
                `Streetlight: ${selectedId || "—"}`,
                `Motion: ${motionText}`,
              ]}
            >
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  Brightness (light_level)
                </div>

                <div
                  style={{
                    height: 14,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.12)",
                    overflow: "hidden",
                  }}
                >
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
                  {lightPct}%{" "}
                  {typeof live?.lightLevel === "number"
                    ? "(live)"
                    : "(backend/state)"}
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
                <div>
                  Temp:{" "}
                  {typeof live?.tempC === "number"
                    ? `${live.tempC}°C`
                    : "—°C"}
                </div>
                <div>
                  Humidity:{" "}
                  {typeof live?.humidity === "number"
                    ? `${live.humidity}%`
                    : "—%"}
                </div>
                <div>
                  Diagnostics:{" "}
                  {live?.diagnostics
                    ? `overall_ok=${String(live.diagnostics.overall_ok)}`
                    : "—"}
                </div>
                <div style={{ marginTop: 8, opacity: 0.85 }}>
                  Last seen: {live?.timestamp || selected?.last_seen || "—"}
                </div>
              </div>
            </BubbleCard>
          </div>

          <div style={{ marginTop: 14 }}>
            <ActivityFeed events={events} wsStatus={wsStatus} maxItems={20} />
          </div>
        </Layout>
      </div>
    </div>
  );
}

function clamp(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function normalizeFeedEvent(msg) {
  const raw = msg;

  // If message comes in as { raw: "..." } from hook parser fallback
  const real = raw && typeof raw === "object" && raw.raw ? raw.raw : raw;

  // If it’s a string, show it as message
  if (typeof real === "string") {
    return {
      id: `msg-${Date.now()}`,
      type: "message",
      timestamp: new Date().toISOString(),
      streetlightId: "—",
      value: real,
      note: "",
    };
  }

  if (!real || typeof real !== "object") return null;

  const streetlightId =
    real.streetlight_id || real.streetlightId || real.device_id || real.deviceId || "—";

  const timestamp = real.timestamp || new Date().toISOString();

  let type = "telemetry";
  if (typeof real?.data?.motion === "boolean") {
    type = real.data.motion ? "motion" : "telemetry";
  } else if (typeof real.type === "string" && real.type.trim()) {
    type = real.type.trim();
  }

  const value =
    real?.data?.light_level ??
    real?.light_level ??
    real?.value ??
    real?.health ??
    "";

  return {
    id: `evt-${timestamp}-${streetlightId}-${type}`,
    type,
    timestamp,
    streetlightId,
    value,
    note: "",
  };
}