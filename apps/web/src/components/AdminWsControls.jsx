import React, { useState } from "react";
import "../styles/admin.css";

export default function AdminWsControls({ wsStatus, onSimulateMotion }) {
  const [flash, setFlash] = useState("idle"); // idle | sending | ok | err

  const handleClick = async () => {
    // flash "sending" for 2 seconds immediately
    setFlash("sending");

    // call the simulate function and read its result
    const ok = await Promise.resolve(onSimulateMotion?.());

    // after 2s, show green/red for 1s, then back to normal
    setTimeout(() => {
      setFlash(ok ? "ok" : "err");
      setTimeout(() => setFlash("idle"), 1000);
    }, 2000);
  };

  const btnClass =
    flash === "sending"
      ? "lwBtn lwBtnSending"
      : flash === "ok"
      ? "lwBtn lwBtnOk"
      : flash === "err"
      ? "lwBtn lwBtnErr"
      : "lwBtn";

  return (
    <div className="lwAdminTop">
      <button
        className={btnClass}
        onClick={handleClick}
        disabled={wsStatus !== "connected" || flash === "sending"}
      >
        Simulate Motion
        <br />
        Event
      </button>

      <div className="lwWsStatus">
        WebSocket status: <b>{wsStatus}</b>
      </div>
    </div>
  );
}
