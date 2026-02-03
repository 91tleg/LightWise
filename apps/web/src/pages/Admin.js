import React from "react";
import Layout from "../components/Layout";
import "../styles/lightwise.css";

export default function Admin() {

 
  return (

    // This block wraps the entire Admin page inside the common Layout.
    // It automatically adds the Sidebar and the TopBar around this page.
    <Layout>

      {/* 
        This is the main container for the Admin page content.
        It holds the header and all admin control cards.
      */}
      <div className="lwPage">

        {/* 
          This block displays the page header at the top:
          - the main title "Admin"
          - and a short description under it.
        */}
        <div className="lwPageHeader">
          <h1 className="lwPageTitle">Admin</h1>
          <p className="lwPageSubtitle">System controls & configuration.</p>
        </div>

        {/* 
          This block is a grid that holds all the admin feature cards.
          Each card represents a different admin control area.
        */}
        <div className="lwBubbleGrid">

          {/* 
            This block is the first admin card: Rules Engine.
            It represents controls for automatic dimming and safety rules.
          */}
          <div className="lwBubbleCard">
            <div className="lwBubbleTop">
              <div className="lwBubbleIcon">🧠</div>
              <div>
                <div className="lwBubbleTitle">Rules Engine</div>
                <div className="lwBubbleSub">Dimming + safety thresholds</div>
              </div>
            </div>

            {/* 
              This block shows small tags (pills) that describe active rule modes.
            */}
            <div className="lwBubblePills">
              <span className="lwBubblePill">Auto</span>
              <span className="lwBubblePill">Night</span>
              <span className="lwBubblePill">Motion</span>
            </div>

            {/* 
              This block shows action buttons related to the Rules Engine.
              These buttons would later open rule editing or logs.
            */}
            <div className="lwBubbleBtnRow">
              <button className="lwBubbleBtn">Edit Rules</button>
              <button className="lwBubbleBtn ghost">View Logs</button>
            </div>
          </div>

          {/* 
            This block is the second admin card: Access control.
            It represents user roles, permissions, and API key management.
          */}
          <div className="lwBubbleCard">
            <div className="lwBubbleTop">
              <div className="lwBubbleIcon">🔐</div>
              <div>
                <div className="lwBubbleTitle">Access</div>
                <div className="lwBubbleSub">API keys & roles</div>
              </div>
            </div>

            {/* 
              This block shows the different access roles in the system.
            */}
            <div className="lwBubblePills">
              <span className="lwBubblePill">Admin</span>
              <span className="lwBubblePill">Operator</span>
              <span className="lwBubblePill">Viewer</span>
            </div>

            {/* 
              This block shows action buttons for managing users and keys.
            */}
            <div className="lwBubbleBtnRow">
              <button className="lwBubbleBtn">Manage Users</button>
              <button className="lwBubbleBtn ghost">Rotate Key</button>
            </div>
          </div>

          {/* 
            This block is the third admin card: Maintenance.
            It represents system maintenance, tickets, and diagnostics.
          */}
          <div className="lwBubbleCard">
            <div className="lwBubbleTop">
              <div className="lwBubbleIcon">🛠️</div>
              <div>
                <div className="lwBubbleTitle">Maintenance</div>
                <div className="lwBubbleSub">Tickets & diagnostics</div>
              </div>
            </div>

            {/* 
              This block shows the current maintenance ticket states.
            */}
            <div className="lwBubblePills">
              <span className="lwBubblePill">Open</span>
              <span className="lwBubblePill">Urgent</span>
              <span className="lwBubblePill">Resolved</span>
            </div>

            {/* 
              This block shows action buttons for creating tickets and running checks.
            */}
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
