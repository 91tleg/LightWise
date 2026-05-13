import React, { useEffect, useMemo, useState } from "react";
import UiIcon from "./UiIcon";
import "../styles/admin.css";

const COMMANDS = [
  { value: "REQUEST_UPLINK", label: "Request Uplink", icon: "activity" },
  { value: "OVERRIDE_ON", label: "Override On", icon: "bolt" },
  { value: "OVERRIDE_OFF", label: "Override Off", icon: "alert" },
  { value: "RESUME_AUTO", label: "Resume Auto", icon: "settings" },
  { value: "SET_LEVELS", label: "Set Levels", icon: "spark" },
  { value: "SET_MOTION_TIMEOUT", label: "Motion Timeout", icon: "activity" },
  { value: "SET_TEMP_DIM", label: "Temporary Dim", icon: "chart" },
  { value: "SET_MOTION_SENSITIVITY", label: "Motion Sensitivity", icon: "radio" },
  { value: "SET_HEARTBEAT_INTERVAL", label: "Heartbeat Interval", icon: "bell" },
  { value: "REBOOT", label: "Reboot", icon: "settings" },
];

const DEFAULT_PARAMS = {
  max_level: 90,
  dim_level: 20,
  timeout_seconds: 30,
  level: 100,
  sensitivity: 7,
  interval_minutes: 60,
  duration_hours: 3,
};

function paramFieldsFor(command) {
  switch (command) {
    case "SET_LEVELS":
      return [
        ["max_level", "Max", 1, 100],
        ["dim_level", "Dim", 0, 100],
      ];
    case "SET_MOTION_TIMEOUT":
      return [["timeout_seconds", "Seconds", 15, 3600]];
    case "OVERRIDE_ON":
      return [["level", "Level", 1, 100]];
    case "SET_MOTION_SENSITIVITY":
      return [["sensitivity", "Sensitivity", 1, 10]];
    case "SET_HEARTBEAT_INTERVAL":
      return [["interval_minutes", "Minutes", 1, 255]];
    case "SET_TEMP_DIM":
      return [
        ["level", "Level", 0, 100],
        ["duration_hours", "Hours", 1, 24],
      ];
    default:
      return [];
  }
}

function buildParams(command, form) {
  return paramFieldsFor(command).reduce((params, [key, , min, max]) => {
    const value = Number(form[key]);
    params[key] = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
    return params;
  }, {});
}

function formatCommandTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function AdminWsControls({
  wsStatus,
  streetlights = [],
  selectedStreetlightId,
  commandHistory = [],
  commandStatus,
  isSending = false,
  lastAck = null,
  onSubscribe,
  onSendCommand,
}) {
  const [streetlightId, setStreetlightId] = useState(selectedStreetlightId || "");
  const [command, setCommand] = useState("REQUEST_UPLINK");
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [flash, setFlash] = useState("idle");

  useEffect(() => {
    setStreetlightId(selectedStreetlightId || "");
  }, [selectedStreetlightId]);

  const isConnected = wsStatus === "connected";
  const isBusy = isSending || flash === "sending";
  const fields = useMemo(() => paramFieldsFor(command), [command]);
  const selectedCommand = COMMANDS.find((item) => item.value === command) || COMMANDS[0];
  const recentCommands = Array.isArray(commandHistory) ? commandHistory.slice(0, 5) : [];

  const statusTone = commandStatus?.tone || (flash === "err" ? "critical" : flash === "ok" ? "healthy" : "neutral");
  const statusText =
    commandStatus?.text ||
    (flash === "err" ? "Command failed." : flash === "ok" ? "Command accepted." : "Ready");

  const handleSubscribeClick = async () => {
    const id = streetlightId.trim();
    if (!id) return;

    setFlash("sending");
    try {
      const ok = await Promise.resolve(onSubscribe?.(id));
      setFlash(ok ? "ok" : "err");
    } catch {
      setFlash("err");
    } finally {
      setTimeout(() => setFlash("idle"), 1100);
    }
  };

  const handleSendClick = async () => {
    const id = streetlightId.trim();
    if (!id) return;

    setFlash("sending");
    try {
      const ok = await Promise.resolve(
        onSendCommand?.(id, {
          command,
          params: buildParams(command, params),
        })
      );
      setFlash(ok ? "ok" : "err");
    } catch {
      setFlash("err");
    } finally {
      setTimeout(() => setFlash("idle"), 1100);
    }
  };

  return (
    <div className="lwAdminDownlinkPanel">
      <div className="lwAdminDownlinkTop">
        <label className="lwAdminField">
          <span className="lwAdminLabel">Streetlight</span>
          <input
            className="lwAdminInput"
            list="lw-admin-streetlight-options"
            value={streetlightId}
            onChange={(event) => setStreetlightId(event.target.value)}
            placeholder="LW-00042"
          />
          <datalist id="lw-admin-streetlight-options">
            {streetlights.map((pole) => (
              <option key={pole.streetlight_id} value={pole.streetlight_id}>
                {pole.name || pole.streetlight_id}
              </option>
            ))}
          </datalist>
        </label>

        <label className="lwAdminField">
          <span className="lwAdminLabel">Command</span>
          <select
            className="lwAdminSelect"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
          >
            {COMMANDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="lwAdminConnectionChip">
          <span className={`lwStatusDot ${isConnected ? "connected" : "idle"}`} />
          <div>
            <div className="lwAdminLabel">WebSocket</div>
            <div className="lwAdminConnectionValue">{wsStatus || "idle"}</div>
          </div>
        </div>
      </div>

      {fields.length ? (
        <div className="lwAdminCommandParams">
          {fields.map(([key, label, min, max]) => (
            <label key={key} className="lwAdminField">
              <span className="lwAdminLabel">{label}</span>
              <input
                className="lwAdminInput"
                type="number"
                min={min}
                max={max}
                value={params[key]}
                onChange={(event) =>
                  setParams((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="lwAdminDownlinkActions">
        <button
          className="lwAdminSecondaryBtn"
          onClick={handleSubscribeClick}
          disabled={!isConnected || !streetlightId.trim() || isBusy}
          type="button"
        >
          Subscribe
        </button>
        <button
          className="lwAdminPrimaryBtn"
          onClick={handleSendClick}
          disabled={!streetlightId.trim() || isBusy}
          type="button"
        >
          <UiIcon name={selectedCommand.icon} size={16} />
          <span>Send Downlink</span>
        </button>
        <span className={`lwAdminChip ${statusTone}`}>{statusText}</span>
      </div>

      <div className="lwAdminDownlinkMeta">
        <div className="lwAdminInlineSurface">
          <strong>{lastAck?.response_code || "No ACK"}</strong>
          <span>
            {lastAck?.command_id
              ? `${lastAck.command || "Command"} ${lastAck.reason_code || ""}`
              : "Awaiting device response"}
          </span>
        </div>

        <div className="lwAdminCommandHistory">
          {recentCommands.length ? (
            recentCommands.map((item) => (
              <div key={item.command_id || `${item.command}-${item.dispatched_at}`} className="lwAdminCommandRow">
                <div>
                  <strong>{item.command || "Command"}</strong>
                  <span>{item.command_id || "Pending correlation"}</span>
                </div>
                <span className={`lwAdminChip ${item.status === "acked" ? "healthy" : item.status === "nacked" ? "critical" : "neutral"}`}>
                  {item.status || "pending"}
                </span>
                <span>{formatCommandTime(item.dispatched_at)}</span>
              </div>
            ))
          ) : (
            <div className="lwAdminInlineSurface">
              <strong>No command history</strong>
              <span>{streetlightId.trim() || "Select a streetlight"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
