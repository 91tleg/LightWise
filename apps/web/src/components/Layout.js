import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "../styles/lightwise.css";

export default function Layout({ title, subtitle, children }) {
  return (
    <div className="lwApp">
      <Sidebar />

      <div className="lwMain">
        <TopBar />

        <div className="lwPage">
          {title ? (
            <header className="lwPageHeader">
              <h1 className="lwPageTitle">{title}</h1>
              {subtitle ? <p className="lwPageSubtitle">{subtitle}</p> : null}
            </header>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}
