import React from "react";
import Layout from "../components/Layout";
import "../styles/lightwise.css";

export default function Admin() {
  return (
    <Layout>
      <div className="lwPage">
        <div className="lwPageHeader">
          <h1 className="lwPageTitle">Admin</h1>
          <p className="lwPageSubtitle">System controls & configuration.</p>
        </div>

        <div className="lwBubbleGrid">
          {/* =========================
              Rules Engine
             ========================= */}
          <div className="lwBubbleCard">
            <div className="lwBubbleTop">
              <div className="lwBubbleIcon">🧠</div>
              <div>
                <div className="lwBubbleTitle">Rules Engine</div>
                <div className="lwBubbleSub">Dimming + safety thresholds</div>
              </div>
            </div>

            <div className="lwBubblePills">
              <span className="lwBubblePill">Auto</span>
              <span className="lwBubblePill">Night</span>
              <span className="lwBubblePill">Motion</span>
            </div>

            {/* Example block */}
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.55)",
                lineHeight: 1.35,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Example</div>
              <div>
                <b>Lightpole ID:</b> LW-001
              </div>
              <div>
                <b>Rule:</b> If motion detected → brightness 100% for 30s
              </div>
              <div>
                <b>Idle:</b> No motion → dim to 30%
              </div>
              <div>
                <b>Night Window:</b> 9:00 PM – 5:30 AM
              </div>
            </div>

            <div className="lwBubbleBtnRow">
              <button className="lwBubbleBtn">Edit Rules</button>
              <button className="lwBubbleBtn ghost">View Logs</button>
            </div>
          </div>

          {/* =========================
              Access
             ========================= */}
          <div className="lwBubbleCard">
            <div className="lwBubbleTop">
              <div className="lwBubbleIcon">🔐</div>
              <div>
                <div className="lwBubbleTitle">Access</div>
                <div className="lwBubbleSub">API keys & roles</div>
              </div>
            </div>

            <div className="lwBubblePills">
              <span className="lwBubblePill">Admin</span>
              <span className="lwBubblePill">Operator</span>
              <span className="lwBubblePill">Viewer</span>
            </div>

            {/* Example block */}
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.55)",
                lineHeight: 1.35,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Example</div>
              <div>
                <b>User:</b> operator@lightwise.city
              </div>
              <div>
                <b>Role:</b> Operator (can view + acknowledge alerts)
              </div>
              <div>
                <b>Key:</b> LW-KEY-7F3A… (last rotated: 2026-02-01)
              </div>
              <div>
                <b>Scope:</b> Map + Alerts (no rule edits)
              </div>
            </div>

            <div className="lwBubbleBtnRow">
              <button className="lwBubbleBtn">Manage Users</button>
              <button className="lwBubbleBtn ghost">Rotate Key</button>
            </div>
          </div>

          {/* =========================
              Maintenance
             ========================= */}
          <div className="lwBubbleCard">
            <div className="lwBubbleTop">
              <div className="lwBubbleIcon">🛠️</div>
              <div>
                <div className="lwBubbleTitle">Maintenance</div>
                <div className="lwBubbleSub">Tickets & diagnostics</div>
              </div>
            </div>

            <div className="lwBubblePills">
              <span className="lwBubblePill">Open</span>
              <span className="lwBubblePill">Urgent</span>
              <span className="lwBubblePill">Resolved</span>
            </div>

            {/* Example block */}
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.55)",
                lineHeight: 1.35,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Example</div>
              <div>
                <b>Ticket:</b> MT-1029
              </div>
              <div>
                <b>Lightpole ID:</b> LW-014
              </div>
              <div>
                <b>Issue:</b> Pole offline (last seen 2h ago)
              </div>
              <div>
                <b>Status:</b> Urgent • Assigned to: Field Team A
              </div>
            </div>

            <div className="lwBubbleBtnRow">
              <button className="lwBubbleBtn">Create Ticket</button>
              <button className="lwBubbleBtn ghost">Run Check</button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
