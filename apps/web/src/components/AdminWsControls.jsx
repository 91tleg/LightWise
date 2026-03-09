import React, { useEffect, useMemo, useState } from "react";
import UiIcon from "./UiIcon";
import "../styles/admin.css";

export default function AdminWsControls({
  wsStatus,
  onSimulateMotion,
  onSubscribeDemo,
  motionState,
  selectedStreetlightId,
}) {
  const [flash, setFlash] = useState("idle");
  const [streetlightId, setStreetlightId] = useState(selectedStreetlightId || "");

  useEffect(() => {
    setStreetlightId(selectedStreetlightId || "");
  }, [selectedStreetlightId]);

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

  return (
    <div className="lwAdminControlBar">
      <button
        className={`${btnClass} lwAdminSimBtn`}
        onClick={handleSimulateClick}
        disabled={!isConnected || isBusy}
        type="button"
      >
        <UiIcon name="spark" size={16} />
        <span>Test Motion Trigger</span>
      </button>

      <div className="lwAdminSubscribeBox">
        <label className="lwAdminMiniLabel">Device Subscription</label>
        <div className="lwAdminSubscribeRow">
          <input
            className="lwAdminCompactInput"
            value={streetlightId}
            onChange={(e) => setStreetlightId(e.target.value)}
            placeholder="Enter streetlight ID"
          />
          <button
            className="lwBtn lwAdminSubscribeBtn"
            onClick={handleSubscribeClick}
            disabled={!isConnected || !streetlightId.trim() || isBusy}
            type="button"
          >
            Subscribe
          </button>
        </div>
      </div>

      <div className="lwAdminConnectionChip">
        <span className={`lwStatusDot ${isConnected ? "connected" : "idle"}`} />
        <div>
          <div className="lwAdminMiniLabel">Connection Status</div>
          <div className="lwAdminConnectionValue">{wsStatus || "idle"}</div>
        </div>
      </div>
    </div>
  );
}