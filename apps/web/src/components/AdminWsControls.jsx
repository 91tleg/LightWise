import React, { useMemo, useState } from "react";
import "../styles/admin.css";

export default function AdminWsControls({
  wsStatus,
  onSimulateMotion,
  onSubscribeDemo,
  motionState,
}) {
  const [flash, setFlash] = useState("idle");

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

  const state = motionState && motionState !== "idle" ? motionState : flash;

  const simulateBtnClass = useMemo(() => {
    if (state === "simulating" || state === "sending") return "lwBtn lwBtnSending";
    if (state === "success" || state === "ok") return "lwBtn lwBtnOk";
    if (state === "error" || state === "err") return "lwBtn lwBtnErr";
    return "lwBtn";
  }, [state]);

  const simulateDisabled =
    wsStatus !== "connected" || flash === "sending" || motionState === "simulating";

  const canSubscribe = wsStatus === "connected";

  return (
    <div className="lwAdminTop">
      {/* Simulate button */}
      <button
        className={`${simulateBtnClass} lwAdminSimBtn`}
        onClick={handleSimulateClick}
        disabled={simulateDisabled}
      >
        Simulate Motion
        <br />
        Event
      </button>

      {/* Subscribe button */}
      <button
        className="lwBtn"
        style={{ marginLeft: 12 }}
        onClick={() => onSubscribeDemo?.()}
        disabled={!canSubscribe}
        title='Sends: {"action":"subscribe","streetlight_id":"LW-001"}'
      >
        Subscribe
        <br />
        LW-001
      </button>

      {/* WS status */}
      <div className="lwWsStatus">
        WebSocket status: <b>{wsStatus}</b>
      </div>
    </div>
  );
}