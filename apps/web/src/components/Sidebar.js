import React, { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "../styles/lightwise.css";

export default function Sidebar() {

  // ===== ROUTING & STATE BLOCK =====
  // useLocation tells us which page we are currently on.
  // useNavigate lets us programmatically move to another page.
  // open controls whether the sliding menu is open or closed.
  const location = useLocation();
  const navigate = useNavigate();

  const isOnLogin = location.pathname === "/";
  const [open, setOpen] = useState(false);

  // ===== MENU ITEMS BLOCK =====
  // This defines the list of pages that appear in the sidebar.
  // Each item has a route path, a label, and an icon.
  const items = useMemo(
    () => [
      { to: "/overview", label: "Overview", icon: "▦" },
      { to: "/map", label: "Map View", icon: "🗺️" },
      { to: "/admin", label: "Admin", icon: "⚙️" },
    ],
    []
  );

  // ===== LOGIN PAGE CHECK BLOCK =====
  // If the user is on the login page, we hide the sidebar completely.
  if (isOnLogin) return null;

 
  return (

    // This is the outer wrapper for the whole sidebar area.
    // It listens to mouse enter and leave to open or close the menu.
    <div
      className="lwSidebarWrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >

      {/* 
        This block is the compact icon rail on the far left.
        It always stays visible and shows only icons.
      */}
      <aside className="lwRail">

        {/* 
          This block holds the vertical stack of navigation icons.
          Each icon links to a different page.
        */}
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

        {/* 
          This block is the back button at the bottom of the rail.
          When clicked, it sends the user back to the Login page.
        */}
        <button
          className="lwRailBackBtn"
          title="Back to Login"
          onClick={() => navigate("/")}
        >
          ↩
        </button>
      </aside>

      {/* 
        This block is the sliding menu that opens when the mouse is over the sidebar.
        It shows both icons and text labels for each page.
      */}
      <aside className={"lwMenu" + (open ? " isOpen" : "")}>

        {/* 
          This block displays the title at the top of the sliding menu.
        */}
        <div className="lwMenuTitle">Menu</div>

        {/* 
          This block lists the full navigation items with icons and labels.
          It highlights the active page and closes the menu when clicked.
        */}
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
