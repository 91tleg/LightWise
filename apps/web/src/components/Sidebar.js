import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import UiIcon from "./UiIcon";
import "../styles/lightwise.css";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isOnLogin = location.pathname === "/";

  const items = useMemo(
    () => [
      { to: "/overview", label: "Overview", icon: "overview" },
      { to: "/analytics", label: "Analytics", icon: "analytics" },
      { to: "/map", label: "Map View", icon: "map" },
      { to: "/admin", label: "Admin", icon: "settings" },
    ],
    []
  );

  if (isOnLogin) return null;

  return (
    <div
      className="lwSidebarWrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
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
                <UiIcon name={item.icon} size={20} />
              </span>
            </NavLink>
          ))}
        </div>

        <button
          type="button"
          className="lwRailBackBtn"
          title="Back to Login"
          onClick={() => navigate("/")}
        >
          <UiIcon name="logout" size={20} />
        </button>
      </aside>

      <aside className={`lwMenu${open ? " isOpen" : ""}`}>
        <div className="lwMenuTitle">Menu</div>

        <nav className="lwMenuList">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `lwMenuItem${isActive ? " isActive" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="lwMenuIcon">
                <UiIcon name={item.icon} size={18} />
              </span>
              <span className="lwMenuLabel">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  );
}