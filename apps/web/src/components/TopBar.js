import React from "react";
import "../styles/lightwise.css";

export default function TopBar() {
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

      <div className="lwTopbarActions">
        <button className="lwTopbarIconBtn" title="Notifications">🔔</button>
        <button className="lwTopbarIconBtn" title="Profile">👤</button>
      </div>
    </header>
  );
}
