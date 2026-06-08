import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useDarkMode } from "../hooks/useDarkMode";
import "../styles/lightwise.css";

export default function Layout({
  title,
  subtitle,
  children,
  backgroundImage,
  pageClassName = "",
}) {
  const theme = useDarkMode();
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
  const pageClassNames = ["lwPage", "lwPageLocked", pageClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="lwAppShell">
      <Sidebar theme={theme} />
      <TopBar />

      <div className="lwMainShell">
        <main className={pageClassNames} style={pageStyle}>
          {header}
          {typeof children === "function" ? children(theme) : children}
        </main>
      </div>
    </div>
  );
}
