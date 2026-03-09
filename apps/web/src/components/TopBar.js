import React from "react";
import UiIcon from "./UiIcon";
import "../styles/lightwise.css";

export default function TopBar() {
  return (
    <header className="lwTopbar lwTopbarClean">
      <div className="lwTopbarBrand lwTopbarBrandClean">
        <div className="lwTopbarLogoShell">
          <img
            src="/images/lightwise-logo-transparent.png"
            alt="LightWise"
            className="lwTopbarLogoClean"
          />
        </div>

        <div className="lwTopbarBrandText">
          <div className="lwTopbarBrandTitle">LightWise</div>
          <div className="lwTopbarBrandSub">Smart light operations dashboard</div>
        </div>
      </div>

      <div className="lwTopbarActions lwTopbarActionsClean">
        <button className="lwTopbarIconBtn lwTopbarIconBtnClean" title="Notifications">
          <UiIcon name="bell" size={18} />
        </button>

        <div className="lwTopbarProfileChip">
          <span className="lwTopbarProfileAvatar">
            <UiIcon name="user" size={16} />
          </span>
          <span className="lwTopbarProfileMeta">
            <strong>Operator</strong>
            <small>Secure session</small>
          </span>
        </div>

        <button className="lwTopbarSignOutBtn" type="button">
          <UiIcon name="logout" size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}