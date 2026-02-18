import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/Layout";
import PoleManager from "../components/PoleManager";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import { useLightWiseWS } from "../services/useLightWiseWS";

import "../styles/lightwise.css";
import "../styles/admin.css";

/**
 * ✅ BACKGROUND FEATURE
 */
import adminBg from "../assets/background/adminBackground1.jpeg";


const WS_URL = process.env.REACT_APP_LIGHTWISE_WS_URL;

export default function Admin() {
  /* =========================================================
     WebSocket Hook
     - status: "connected" | "connecting" | "disconnected" (etc)
     - lastMessage: last message received from backend
     - send: function to send a message (your wrapper)
  ========================================================== */
  const { status: wsStatus, lastMessage, send } = useLightWiseWS(WS_URL);

  /* =========================================================
     Motion UI State (for button flash feedback)
     idle | simulating | success | error
  ========================================================== */
  const [motionState, setMotionState] = useState("idle");

  /* =========================================================
     Live state (only set when *real* data arrives)
     This prevents your UI showing fake/default data.
  ========================================================== */
  const [liveState, setLiveState] = useState({
    lastPoleId: null,
    lastMotionTs: null,
    lastMotionValue: null,
    lastEventType: null,
  });

  /* =========================================================
     SIMULATE MOTION EVENT
     - called when user clicks "Simulate Motion"
     - sends a message to WS backend
  ========================================================== */
  const simulateMotion = () => {
    if (wsStatus !== "connected") {
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
      return false;
    }

    setMotionState("simulating");

    const ok = send({
      action: "broadcast",
      payload: {
        type: "motion",
        poleId: "pole_demo",
        value: 1,
        timestamp: new Date().toISOString(),
      },
    });

    if (!ok) {
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
    }

    return ok;
  };

  /* =========================================================
     Handle incoming WS messages
     - parses message safely
     - updates liveState only if message has real data
     - sets motionState success/error for UI feedback
  ========================================================== */
  useEffect(() => {
    if (!lastMessage) return;

    try {
      // lastMessage could be string or object depending on your hook
      const msg =
        typeof lastMessage === "string" ? JSON.parse(lastMessage) : lastMessage;

      // Attempt to read fields even if backend sends different shape
      const type = msg?.type || msg?.payload?.type || null;
      const poleId =
        msg?.poleId || msg?.payload?.poleId || msg?.deviceId || null;
      const ts = msg?.timestamp || msg?.payload?.timestamp || msg?.time || null;
      const value = msg?.value ?? msg?.payload?.value ?? null;

      // Only update when we actually got something real
      const hasRealData = Boolean(type || poleId || ts || value !== null);

      if (hasRealData) {
        setLiveState((prev) => ({
          ...prev,
          lastEventType: type || prev.lastEventType,
          lastPoleId: poleId || prev.lastPoleId,
          lastMotionTs:
            type === "motion" ? ts || prev.lastMotionTs : prev.lastMotionTs,
          lastMotionValue:
            type === "motion"
              ? value ?? prev.lastMotionValue
              : prev.lastMotionValue,
        }));
      }

      // If we received a motion event, show "success" flash on button
      if (type === "motion") {
        setMotionState("success");
        setTimeout(() => setMotionState("idle"), 1000);
      }
    } catch (err) {
      console.error("Invalid WS message:", err);
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
    }
  }, [lastMessage]);

  /* =========================================================
     Derived display values (UI-friendly)
     - show N/A when value hasn't arrived yet
  ========================================================== */
  const display = useMemo(() => {
    return {
      poleId: liveState.lastPoleId ?? "N/A",
      lastEventType: liveState.lastEventType ?? "N/A",
      lastMotion:
        liveState.lastMotionValue === null ||
        liveState.lastMotionValue === undefined
          ? "N/A"
          : String(liveState.lastMotionValue),
      lastMotionTs: liveState.lastMotionTs ?? "N/A",
    };
  }, [liveState]);

  /* =========================================================
     ✅ BACKGROUND FEATURE (FULL PAGE)
     This wrapper makes the adminBg image cover the entire page.
     
  ========================================================== */
  return (
    <div
      className="lwAdminPage"
      style={{
        // ✅ This is the full-page background image
        backgroundImage: `url(${adminBg})`,
      }}
    >
      <div className="lwAdminPageOverlay">
        {/* 
          ✅ Overlay purpose:
          - Keeps cards readable on top of the image
          - Does NOT blur buttons/content (no backdrop-filter)
          - You can tune transparency in admin.css
          - To remove overlay: delete this wrapper div
        */}

        <Layout title="Admin" subtitle="System controls & configuration.">
          <AdminWsControls
            wsStatus={wsStatus}
            onSimulateMotion={simulateMotion}
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
