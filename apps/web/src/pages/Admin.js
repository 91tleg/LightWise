import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import PoleManager from "../components/PoleManager";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import { useLightWiseWS } from "../services/useLightWiseWS";

import "../styles/lightwise.css";
import "../styles/admin.css";

import adminBg from "../assets/background/adminBackground1.jpeg";

// ✅ IMPORTANT: this must match your .env key
const WS_URL = process.env.REACT_APP_LIGHTWISE_WS_URL;

export default function Admin() {
  const { status: wsStatus, lastMessage, subscribe } = useLightWiseWS(WS_URL);

  const [motionState, setMotionState] = useState("idle");

  const [liveState, setLiveState] = useState({
    lastPoleId: null,
    lastMotionTs: null,
    lastMotionValue: null,
    lastEventType: null,
  });

  /**
   * ✅ SIMULATE MOTION (frontend demo)
   * Backend broadcast may not exist. This keeps your demo looking alive.
   */
  const simulateMotion = () => {
    if (wsStatus !== "connected") {
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
      return false;
    }

    setMotionState("simulating");

    // Demo payload shaped loosely like real telemetry
    const now = new Date().toISOString();
    const demo = {
      tenant_id: "tenant-001",
      streetlight_id: process.env.REACT_APP_DEFAULT_STREETLIGHT_ID || "LW-00042",
      timestamp: now,
      health: "OK",
      data: {
        lux: Math.round(Math.random() * 3000) / 10,
        temp_c: 25,
        humidity: 60,
        motion: true,
        light_level: 80,
      },
      diagnostics: {
        overall_ok: true,
        system_degraded: false,
        ambient_primary_ok: true,
        ambient_secondary_ok: true,
        th_ok: true,
        motion_primary_ok: true,
        motion_secondary_ok: true,
      },
      type: "motion",
      value: 1,
    };

    // Update UI state immediately (without depending on backend)
    setLiveState((prev) => ({
      ...prev,
      lastEventType: "motion",
      lastPoleId: demo.streetlight_id,
      lastMotionTs: now,
      lastMotionValue: 1,
    }));

    setMotionState("success");
    setTimeout(() => setMotionState("idle"), 1000);

    // If you STILL want to attempt backend broadcast, you can uncomment:
    // send({ action: "broadcast", payload: demo });

    return true;
  };

  /**
   * ✅ THIS is where you do:
   * const subscribeDemo = (id) => ... return subscribe(id)
   */
  const subscribeDemo = (id) => {
    if (wsStatus !== "connected") return false;
    return subscribe(id); // uses the hook's updated contract
  };

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const msg =
        typeof lastMessage === "string" ? JSON.parse(lastMessage) : lastMessage;

      // Max telemetry doesn't include type/value like your old demo,
      // so we infer motion from data.motion if present.
      const inferredType =
        msg?.type ||
        (msg?.data?.motion === true ? "motion" : null) ||
        msg?.payload?.type ||
        null;

      const poleId =
        msg?.streetlight_id ||
        msg?.streetlightId ||
        msg?.device_id ||
        msg?.deviceId ||
        msg?.poleId ||
        msg?.payload?.streetlight_id ||
        msg?.payload?.device_id ||
        msg?.payload?.poleId ||
        null;

      const ts =
        msg?.timestamp ||
        msg?.payload?.timestamp ||
        msg?.time ||
        msg?.created_at ||
        null;

      const value =
        msg?.value ??
        msg?.payload?.value ??
        (typeof msg?.data?.motion === "boolean" ? (msg.data.motion ? 1 : 0) : null);

      const hasRealData = Boolean(inferredType || poleId || ts || value !== null);

      if (hasRealData) {
        setLiveState((prev) => ({
          ...prev,
          lastEventType: inferredType || prev.lastEventType,
          lastPoleId: poleId || prev.lastPoleId,
          lastMotionTs:
            inferredType === "motion" ? ts || prev.lastMotionTs : prev.lastMotionTs,
          lastMotionValue:
            inferredType === "motion"
              ? value ?? prev.lastMotionValue
              : prev.lastMotionValue,
        }));
      }

      if (inferredType === "motion") {
        setMotionState("success");
        setTimeout(() => setMotionState("idle"), 1000);
      }
    } catch (err) {
      console.error("Invalid WS message:", err);
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
    }
  }, [lastMessage]);

  const display = useMemo(() => {
    return {
      poleId: liveState.lastPoleId ?? "N/A",
      lastEventType: liveState.lastEventType ?? "N/A",
      lastMotion:
        liveState.lastMotionValue === null || liveState.lastMotionValue === undefined
          ? "N/A"
          : String(liveState.lastMotionValue),
      lastMotionTs: liveState.lastMotionTs ?? "N/A",
    };
  }, [liveState]);

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
              <div className="lwCardContent">
                <div>
                  <b>Lightpole ID:</b> {display.poleId}
                </div>
                <div>
                  <b>Mode:</b> N/A
                </div>
                <div>
                  <b>Last Event:</b> {display.lastEventType}
                </div>
              </div>
            </BubbleCard>

            <BubbleCard
              icon="🔐"
              title="Access"
              sub="API keys & roles"
              pills={["Admin", "Operator", "Viewer"]}
              primaryLabel="Manage Users"
              secondaryLabel="Rotate Key"
              onPrimary={() => alert("Manage Users (demo)")}
              onSecondary={() => alert("Rotate Key (demo)")}
            >
              <div className="lwCardContent">
                <div>
                  <b>Users:</b> N/A
                </div>
                <div>
                  <b>Roles:</b> N/A
                </div>
                <div>
                  <b>API Key:</b> N/A
                </div>
              </div>
            </BubbleCard>

            <BubbleCard
              icon="🛠️"
              title="Maintenance"
              sub="Tickets & diagnostics"
              pills={["Open", "Urgent", "Resolved"]}
              primaryLabel="Create Ticket"
              secondaryLabel="Run Check"
              onPrimary={() => alert("Create Ticket (demo)")}
              onSecondary={() => alert("Run Check (demo)")}
            >
              <div className="lwCardContent">
                <div>
                  <b>Open Tickets:</b> N/A
                </div>
                <div>
                  <b>Last Motion:</b> {display.lastMotion}
                </div>
                <div>
                  <b>Last Motion Time:</b> {display.lastMotionTs}
                </div>
              </div>
            </BubbleCard>
          </div>
        </Layout>
      </div>
    </div>
  );
}