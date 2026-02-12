import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../styles/lightwise.css";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isOnLogin = location.pathname === "/";
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => [
      { to: "/overview", label: "Overview", icon: "▦" },
      { to: "/map", label: "Map View", icon: "🗺️" },
      { to: "/admin", label: "Admin", icon: "⚙️" },
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
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              title={it.label}
              className={({ isActive }) =>
                "lwRailBtn" + (isActive ? " isActive" : "")
              }
              onClick={() => setOpen(false)}
            >
              <span className="lwRailIcon">{it.icon}</span>
            </NavLink>
          ))}
        </div>

        <button
          className="lwRailBackBtn"
          title="Back to Login"
          onClick={() => navigate("/")}
        >
          ↩
        </button>
      </aside>

      <aside className={"lwMenu" + (open ? " isOpen" : "")}>
        <div className="lwMenuTitle">Menu</div>

        <nav className="lwMenuList">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                "lwMenuItem" + (isActive ? " isActive" : "")
              }
              onClick={() => setOpen(false)}
            >
              <span className="lwMenuIcon">{it.icon}</span>
              <span className="lwMenuLabel">{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  );
}
