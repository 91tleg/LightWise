// apps/web/src/components/AdminWsControls.jsx
import React, { useMemo, useState } from "react";
import "../styles/admin.css";

export default function AdminWsControls({
  wsStatus,
  onSimulateMotion,
  onSubscribeDemo,
  motionState,
}) {
  const [flash, setFlash] = useState("idle");
  const [streetlightId, setStreetlightId] = useState(
    process.env.REACT_APP_DEFAULT_STREETLIGHT_ID || "LW-00042"
  );

  const handleSimulateClick = async () => {
    setFlash("sending");
    try {
      const ok = await Promise.resolve(onSimulateMotion?.());
      setFlash(ok ? "ok" : "err");
      setTimeout(() => setFlash("idle"), 900);
    } catch {
      setFlash("err");
      setTimeout(() => setFlash("idle"), 900);
    }
  };

  const handleSubscribeClick = async () => {
    setFlash("sending");
    try {
      const ok = await Promise.resolve(onSubscribeDemo?.(streetlightId));
      setFlash(ok ? "ok" : "err");
      setTimeout(() => setFlash("idle"), 900);
    } catch {
      setFlash("err");
      setTimeout(() => setFlash("idle"), 900);
    }
  };

  const state = motionState && motionState !== "idle" ? motionState : flash;

  const simulateBtnClass = useMemo(() => {
    if (state === "simulating" || state === "sending") return "lwBtn lwBtnSending";
    if (state === "success" || state === "ok") return "lwBtn lwBtnOk";
    if (state === "error" || state === "err") return "lwBtn lwBtnErr";
    return "lwBtn";
  }, [state]);

  const isConnected = wsStatus === "connected";
  const isBusy = flash === "sending" || motionState === "simulating";

  const simulateDisabled = !isConnected || isBusy;
  const subscribeDisabled = !isConnected || isBusy;

  const subscribeTitle = `Sends: {"action":"subscribe","streetlight_id":"${streetlightId}"}`;

  return (
    <div className="lwAdminTop">
      <button
        className={`${simulateBtnClass} lwAdminSimBtn`}
        onClick={handleSimulateClick}
        disabled={simulateDisabled}
        title={
          !isConnected
            ? "Connect WS first"
            : "Simulate Motion is frontend-demo only unless backend supports broadcast"
        }
      >
        Simulate Motion
        <br />
        (WS)
      </button>

      <div style={{ marginLeft: 12, display: "flex", flexDirection: "column" }}>
        <input
          value={streetlightId}
          onChange={(e) => setStreetlightId(e.target.value)}
          placeholder="Streetlight ID"
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            marginBottom: 8,
            width: 160,
          }}
        />

        <button
          className="lwBtn"
          style={{ marginLeft: 0 }}
          onClick={handleSubscribeClick}
          disabled={subscribeDisabled}
          title={subscribeTitle}
        >
          Subscribe
          <br />
          {streetlightId || "LW-00042"}
        </button>
      </div>

      <div className="lwWsStatus" style={{ marginLeft: 12 }}>
        WebSocket status: <b>{wsStatus}</b>
      </div>
    </div>
  );
}