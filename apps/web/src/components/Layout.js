// apps/web/src/components/Layout.js

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
        minHeight: "100%",
      }
    : {};

  // Keep a subtle overlay so the image doesn’t wash out, but not dark
  const overlayStyle = backgroundImage
    ? {
        backgroundColor: "rgba(255,255,255,0.08)", // very light overlay (not dark)
        minHeight: "100%",
        width: "100%",
      }
    : null;

  // Light-blue header card (this is the part you said you can’t see)
  const headerCardStyle = backgroundImage
    ? {
        background: "rgba(220, 240, 255, 0.92)", // very light blue
        borderRadius: 16,
        padding: "14px 16px",
        marginBottom: 14,
        boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
      }
    : null;

  const titleStyle = backgroundImage
    ? { color: "#0b1b2b", margin: 0 }
    : undefined;

  const subtitleStyle = backgroundImage
    ? { color: "rgba(11,27,43,0.85)", marginTop: 6 }
    : undefined;

  const Header = () =>
    title ? (
      <header className="lwPageHeader" style={headerCardStyle || undefined}>
        <h1 className="lwPageTitle" style={titleStyle}>
          {title}
        </h1>
        {subtitle ? (
          <p className="lwPageSubtitle" style={subtitleStyle}>
            {subtitle}
          </p>
        ) : null}
      </header>
    ) : null;

  return (
    <div className="lwApp">
      <Sidebar />

      <div className="lwMain">
        <TopBar />

        <div className="lwPage" style={pageStyle}>
          {overlayStyle ? (
            <div style={overlayStyle}>
              <Header />
              {children}
            </div>
          ) : (
            <>
              <Header />
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}