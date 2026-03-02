import React, { useMemo } from "react";
import "../styles/lightwise.css";

export default function TopBar() {
  const info = useMemo(() => {
    const wsUrl = (process.env.REACT_APP_WS_URL || process.env.REACT_APP_LIGHTWISE_WS_URL || "").trim();
    const apiBase = (process.env.REACT_APP_API_BASE || "").trim();
    const useMock = String(process.env.REACT_APP_USE_MOCK || "false").toLowerCase() === "true";
    const tenant = (process.env.REACT_APP_TENANT_ID || "tenant-001").trim();

    // derive stage label from url (dev / production / etc.)
    const stage =
      wsUrl.includes("/dev") || apiBase.includes("/dev")
        ? "DEV"
        : wsUrl.includes("/prod") || apiBase.includes("/prod")
        ? "PROD"
        : "CUSTOM";

    const missing = [];
    if (!wsUrl) missing.push("REACT_APP_WS_URL");
    if (!apiBase) missing.push("REACT_APP_API_BASE");

    return { wsUrl, apiBase, useMock, tenant, stage, missing };
  }, []);

  return (
    <header className="lwTopbar">
      <div className="lwTopbarBrand">
        <div className="lwTopbarBadge">
          <img src="/images/lightwise-logo.jpeg" alt="LightWise" className="lwTopbarImg" />
        </div>

        <div className="lwTopbarBadge">
          <img src="/images/lightwise-motto.jpeg" alt="LightWise Motto" className="lwTopbarImg" />
        </div>

        {/* DEV banner / env status (safe to show, no secrets) */}
        <div
          style={{
            marginLeft: 12,
            padding: "6px 10px",
            borderRadius: 12,
            background: "rgba(255,255,255,.22)",
            color: "rgba(255,255,255,.95)",
            fontWeight: 800,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            whiteSpace: "nowrap",
          }}
          title={`WS set: ${Boolean(info.wsUrl)} | API set: ${Boolean(info.apiBase)} | tenant: ${info.tenant}`}
        >
          <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(0,0,0,.18)" }}>
            {info.stage}
          </span>
          <span>MOCK: {info.useMock ? "ON" : "OFF"}</span>
          <span>tenant: {info.tenant}</span>

          {info.missing.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,0,0,.25)",
                fontWeight: 900,
              }}
              title={`Missing env: ${info.missing.join(", ")} (set these in .env.local)`}
            >
              ENV MISSING
            </span>
          )}
        </div>
      </div>

      <div className="lwTopbarActions">
        <button className="lwTopbarIconBtn" title="Notifications">🔔</button>
        <button className="lwTopbarIconBtn" title="Profile">👤</button>
      </div>
    </header>
  );
}