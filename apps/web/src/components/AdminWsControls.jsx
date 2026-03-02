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

  const isConnected = wsStatus === "connected";
  const isBusy = flash === "sending" || motionState === "simulating";

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

  const btnClass = useMemo(() => {
    if (state === "simulating" || state === "sending") return "lwBtn lwBtnSending";
    if (state === "success" || state === "ok") return "lwBtn lwBtnOk";
    if (state === "error" || state === "err") return "lwBtn lwBtnErr";
    return "lwBtn";
  }, [state]);

  const simulateDisabled = !isConnected || isBusy;
  const subscribeDisabled = !isConnected || isBusy || !String(streetlightId || "").trim();

  const subscribeTitle = `Sends: {"action":"subscribe","streetlight_id":"${streetlightId}"}`;

  return (
    <div className="lwAdminTop">
      <button
        className={`${btnClass} lwAdminSimBtn`}
        onClick={handleSimulateClick}
        disabled={simulateDisabled}
        title={
          !isConnected
            ? "Connect WS first"
            : "UI-only demo (Kirat confirmed WS supports only 'subscribe' route right now)"
        }
      >
        Simulate Motion
        <br />
        (UI only)
      </button>

      <div style={{ marginLeft: 12, display: "flex", flexDirection: "column" }}>
        <input
          value={streetlightId}
          onChange={(e) => setStreetlightId(e.target.value)}
          placeholder="Streetlight ID (e.g. LW-00042)"
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            marginBottom: 8,
            width: 190,
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
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
          WS routes: $connect / $default / $disconnect / <b>subscribe</b>
        </div>
      </div>
    </div>
  );
}