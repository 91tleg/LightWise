import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import UiIcon from "./UiIcon";
import { useLightWise } from "../hooks/useLightWise";
import "../styles/lightwise.css";

export default function Sidebar({ theme }) {
  const location = useLocation();
  const { operator, signOut } = useLightWise();
  const { darkMode, themeMode, setThemeMode } = theme;

  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const closeTimerRef = useRef(null);

  const isAuthPage = location.pathname === "/" || location.pathname === "/callback";

  const items = useMemo(
    () => [
      { to: "/overview", label: "Overview", icon: "overview" },
      { to: "/analytics", label: "Analytics", icon: "analytics" },
      { to: "/map", label: "Map View", icon: "map" },
      { to: "/admin", label: "Admin", icon: "settings" },
    ],
    []
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function openAccountPanel() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setAccountOpen(true);
  }

  function closeAccountPanelSoon() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setAccountOpen(false);
    }, 180);
  }

  function handleQuickToggle() {
    if (themeMode === "auto") {
      setThemeMode("dark");
      return;
    }
    setThemeMode(darkMode ? "light" : "dark");
  }

  if (isAuthPage) return null;

  return (
    <div
      className="lwSidebarWrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false);
        closeAccountPanelSoon();
      }}
    >
      <aside className="lwRail">
        <div className="lwRailStack">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `lwRailBtn${isActive ? " isActive" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="lwRailIcon">
                <UiIcon name={item.icon} size={22} />
              </span>
            </NavLink>
          ))}
        </div>

        <div
          className="lwRailBottom"
          onMouseEnter={openAccountPanel}
          onMouseLeave={closeAccountPanelSoon}
        >
          <button
            type="button"
            className={`lwRailAccountBtnLegacy${accountOpen ? " isOpen" : ""}`}
            title="Account"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((prev) => !prev)}
          >
            <span className="lwRailAccountInitials">{operator?.initials || "OP"}</span>
          </button>
        </div>
      </aside>

      <aside
        className={`lwMenu${open ? " isOpen" : ""}`}
        onMouseEnter={() => setOpen(true)}
      >
        <div className="lwMenuTop">
          <div className="lwMenuTitle">Menu</div>
        </div>

        <nav className="lwMenuList">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `lwMenuItem${isActive ? " isActive" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="lwMenuIcon">
                <UiIcon name={item.icon} size={20} />
              </span>
              <span className="lwMenuLabel">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div
          className={`lwMenuAccountPanel${accountOpen ? " isOpen" : ""}`}
          onMouseEnter={openAccountPanel}
          onMouseLeave={closeAccountPanelSoon}
        >
          <div className="lwRailAccountCard">
            <div className="lwRailAccountIdentity">
              <div className="lwRailAccountAvatar">{operator?.initials || "OP"}</div>
              <div className="lwRailAccountMeta">
                <strong>{operator?.name || "Operator"}</strong>
                <small>{operator?.email || "operator@lightwise.local"}</small>
              </div>
            </div>

            <div className="lwRailPopoverSection">
              <div className="lwRailToggleRow">
                <div className="lwRailToggleText">
                  <strong>
                    {themeMode === "auto"
                      ? "Auto mode"
                      : darkMode
                      ? "Dark mode"
                      : "Light mode"}
                  </strong>
                  <span>
                    {themeMode === "auto"
                      ? "Switches by time of day"
                      : darkMode
                      ? "Night theme enabled"
                      : "Day theme enabled"}
                  </span>
                </div>

                <button
                  type="button"
                  className={`lwThemeSwitch ${darkMode ? "isOn" : ""}${
                    themeMode === "auto" ? " isAuto" : ""
                  }`}
                  onClick={handleQuickToggle}
                  aria-label="Quick toggle theme"
                  aria-pressed={darkMode}
                >
                  <span className="lwThemeSwitchTrack">
                    <span className="lwThemeSwitchThumb" />
                    <span className="lwThemeSwitchLabel">
                      {themeMode === "auto" ? "AUTO" : darkMode ? "ON" : "OFF"}
                    </span>
                  </span>
                </button>
              </div>

              <div className="lwThemeModeTabs">
                <button
                  type="button"
                  className={`lwThemeModeTab${themeMode === "light" ? " isActive" : ""}`}
                  onClick={() => setThemeMode("light")}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={`lwThemeModeTab${themeMode === "dark" ? " isActive" : ""}`}
                  onClick={() => setThemeMode("dark")}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={`lwThemeModeTab${themeMode === "auto" ? " isActive" : ""}`}
                  onClick={() => setThemeMode("auto")}
                >
                  Auto
                </button>
              </div>
            </div>

            <button
              type="button"
              className="lwRailPopoverAction lwRailPopoverActionDanger"
              onClick={signOut}
            >
              <span className="lwRailPopoverActionIcon">
                <UiIcon name="logout" size={14} />
              </span>
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
