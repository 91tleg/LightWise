import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import "../styles/lightwise.css";

export default function Layout({ title, subtitle, children, backgroundImage }) {
  const pageStyle = backgroundImage
    ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  const header = title ? (
    <header className="lwPageHeader">
      <h1 className="lwPageTitle">{title}</h1>
      {subtitle ? <p className="lwPageSubtitle">{subtitle}</p> : null}
    </header>
  ) : null;

  return (
    <div className="lwAppShell">
      <Sidebar />
      <TopBar />

      <div className="lwMainShell">
        <main className="lwPage lwPageLocked" style={pageStyle}>
          {header}
          {children}
        </main>
      </div>
    </div>
  );
}