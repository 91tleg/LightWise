import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
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
      </div>

      <div className="lwTopbarActions" ref={menuRef} style={{ position: "relative" }}>
        <button className="lwTopbarIconBtn" title="Notifications">🔔</button>

        <button
          className="lwTopbarIconBtn"
          title="Profile"
          aria-haspopup="menu"
          aria-expanded={open ? "true" : "false"}
          onClick={() => setOpen((v) => !v)}
        >
          👤
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 10px)",
              width: 280,
              borderRadius: 16,
              background: "rgba(18, 22, 28, 0.92)",
              color: "rgba(255,255,255,0.95)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.10)",
              overflow: "hidden",
              zIndex: 1000,
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ padding: "14px 14px 10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                  }}
                >
                  👤
                </div>

                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span style={{ fontWeight: 900, fontSize: 13 }}>Environment</span>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>
                    {info.stage} • MOCK {info.useMock ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />

            <div style={{ padding: 12, display: "grid", gap: 10, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ opacity: 0.75 }}>Stage</span>
                <span style={{ fontWeight: 800 }}>{info.stage}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ opacity: 0.75 }}>Mock</span>
                <span style={{ fontWeight: 800 }}>{info.useMock ? "ON" : "OFF"}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ opacity: 0.75 }}>Tenant</span>
                <span style={{ fontWeight: 800 }}>{info.tenant}</span>
              </div>

              {info.missing.length > 0 && (
                <div
                  style={{
                    marginTop: 2,
                    padding: "8px 10px",
                    borderRadius: 12,
                    background: "rgba(255,0,0,0.14)",
                    border: "1px solid rgba(255,0,0,0.20)",
                    fontWeight: 800,
                  }}
                  title={`Missing env: ${info.missing.join(", ")} (set these in .env.local)`}
                >
                  ⚠ ENV MISSING: {info.missing.join(", ")}
                </div>
              )}
            </div>

            <div style={{ padding: 10, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.95)",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}