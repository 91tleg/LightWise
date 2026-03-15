import React from "react";
import { useLocation } from "react-router-dom";
import "../styles/lightwise.css";

export default function TopBar() {
  const location = useLocation();

  if (location.pathname === "/" || location.pathname === "/callback") return null;

  return (
    <header className="lwTopbar lwTopbarMinimal">
      <div className="lwTopbarBrandLockup">
        <div className="lwTopbarLogoMarkWrap">
          <img
            src="/images/lightwise-logo-transparent.png"
            alt="LightWise logo"
            className="lwTopbarLogoMark"
          />
        </div>

        <div className="lwTopbarBrandImageWrap">
          <img
            src="/images/lightwise-transparent-motto.png"
            alt="LightWise motto"
            className="lwTopbarBrandImage"
          />
        </div>
      </div>
    </header>
  );
}
