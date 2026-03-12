import React, { useContext, useEffect, useRef, useState } from "react";
import UiIcon from "./UiIcon";
import { LightWiseContext } from "../context/LightWiseProvider";
import "../styles/lightwise.css";

export default function TopBar() {
  const { darkMode, toggleDarkMode } = useContext(LightWiseContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

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
        <button className="lwTopbarIconBtn lwTopbarIconBtnClean" title="Notifications" type="button">
          <UiIcon name="bell" size={18} />
        </button>

        <div className="lwTopbarProfileWrap" ref={menuRef}>
          <button
            type="button"
            className={`lwTopbarProfileChip lwTopbarProfileChipButton${menuOpen ? " isOpen" : ""}`}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="Operator settings"
          >
            <span className="lwTopbarProfileAvatar">
              <UiIcon name="user" size={16} />
            </span>
            <span className="lwTopbarProfileMeta">
              <strong>Operator</strong>
              <small>Secure session</small>
            </span>
            <span className={`lwTopbarChevron${menuOpen ? " isOpen" : ""}`}>▾</span>
          </button>

          {menuOpen ? (
            <div className="lwOperatorMenu" role="menu">
              <div className="lwOperatorMenuHeader">
                <div className="lwOperatorMenuTitle">Appearance</div>
                <div className="lwOperatorMenuSub">Choose light or dark mode</div>
              </div>

              <div className="lwOperatorToggleRow">
                <div className="lwOperatorToggleText">
                  <strong>Dark mode</strong>
                  <span>{darkMode ? "On" : "Off"}</span>
                </div>

                <button
                  type="button"
                  className={`lwThemeSwitch${darkMode ? " isOn" : ""}`}
                  onClick={toggleDarkMode}
                  aria-pressed={darkMode}
                  title={darkMode ? "Turn dark mode off" : "Turn dark mode on"}
                >
                  <span className="lwThemeSwitchTrack">
                    <span className="lwThemeSwitchLabel">{darkMode ? "On" : "Off"}</span>
                    <span className="lwThemeSwitchThumb" />
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button className="lwTopbarSignOutBtn" type="button">
          <UiIcon name="logout" size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}