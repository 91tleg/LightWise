import React, { useState, useEffect } from "react";
import Layout from "../components/Layout";
import PoleManager from "../components/PoleManager";
import ActivityFeed from "../components/ActivityFeed";
import BubbleCard from "../components/BubbleCard";
import AdminWsControls from "../components/AdminWsControls";
import { useLightWiseWS } from "../services/useLightWiseWS";
import "../styles/lightwise.css";
import "../styles/admin.css";

const WS_URL = "wss://kgwfa0ip6h.execute-api.us-east-1.amazonaws.com/prod";

export default function Admin() {
  const { status: wsStatus, lastMessage, send } = useLightWiseWS(WS_URL);

  const [motionState, setMotionState] = useState("idle");
  // idle | simulating | success | error

  /* =============================
     SIMULATE MOTION EVENT
  ============================== */
  const simulateMotion = () => {
    if (wsStatus !== "connected") {
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
      return;
    }

    setMotionState("simulating");

    send({
      action: "broadcast",
      payload: {
        type: "motion",
        poleId: "pole_demo",
        value: 1,
        timestamp: new Date().toISOString(),
      },
    });
  };

  /* =============================
     CONFIRM SUCCESS WHEN MESSAGE RETURNS
  ============================== */
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const msg =
        typeof lastMessage === "string"
          ? JSON.parse(lastMessage)
          : lastMessage;

      if (msg?.type === "motion") {
        setMotionState("success");
        setTimeout(() => setMotionState("idle"), 1000);
      }
    } catch (err) {
      console.error("Invalid WS message:", err);
      setMotionState("error");
      setTimeout(() => setMotionState("idle"), 1000);
    }
  }, [lastMessage]);

  return (
    <Layout title="Admin" subtitle="System controls & configuration.">
      <AdminWsControls
        wsStatus={wsStatus}
        onSimulateMotion={simulateMotion}
        motionState={motionState}
      />

      <PoleManager />

      <ActivityFeed
        wsStatus={wsStatus}
        lastMessage={lastMessage}
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
          <div className="lwBubbleExample">
            <div className="lwBubbleExampleTitle">Example</div>
            <div><b>Lightpole ID:</b> LW-001</div>
            <div><b>Rule:</b> If motion detected → brightness 100% for 30s</div>
            <div><b>Idle:</b> No motion → dim to 30%</div>
            <div><b>Night Window:</b> 9:00 PM – 5:30 AM</div>
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
          <div className="lwBubbleExample">
            <div className="lwBubbleExampleTitle">Example</div>
            <div><b>User:</b> operator@lightwise.city</div>
            <div><b>Role:</b> Operator</div>
            <div><b>Key:</b> LW-KEY-7F3A…</div>
            <div><b>Scope:</b> Map + Alerts</div>
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
          <div className="lwBubbleExample">
            <div className="lwBubbleExampleTitle">Example</div>
            <div><b>Ticket:</b> MT-1029</div>
            <div><b>Lightpole ID:</b> LW-014</div>
            <div><b>Issue:</b> Pole offline</div>
            <div><b>Status:</b> Urgent</div>
          </div>
        </BubbleCard>
      </div>
    </Layout>
  );
}
