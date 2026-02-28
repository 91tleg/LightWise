// apps/web/src/components/AdminWsControls.jsx

import React, { useMemo, useState } from "react";
import "../styles/admin.css";

export default function AdminWsControls({ wsStatus, onSimulateMotion, motionState }) {
  const [flash, setFlash] = useState("idle");

  const handleClick = async () => {
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

  const btnClass = useMemo(() => {
    if (state === "simulating" || state === "sending") return "lwBtn lwBtnSending";
    if (state === "success" || state === "ok") return "lwBtn lwBtnOk";
    if (state === "error" || state === "err") return "lwBtn lwBtnErr";
    return "lwBtn";
  }, [state]);

  const disabled =
    wsStatus !== "connected" || flash === "sending" || motionState === "simulating";

  return (
    <div className="lwAdminTop">
      <button className={`${btnClass} lwAdminSimBtn`} onClick={handleClick} disabled={disabled}>
        Re-subscribe
        <br />
        (WS)
      </button>

      <div className="lwWsStatus">
        WebSocket status: <b>{wsStatus}</b>
      </div>
    </div>
  );
}