import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";


// ===== COMPONENT DEFINITION BLOCK =====
// This defines a component called Layout.
// It receives three values from the page that uses it:
// - title: the big title at the top of the page
// - subtitle: a smaller text under the title
// - children: the main content of the page
export default function Layout({ title, subtitle, children }) {

  // ===== MAIN RETURN BLOCK =====
  // Everything inside return(...) is what will be drawn on the screen
  return (

    // This is the outer container for the whole app layout
    // It holds both the sidebar and the main content area
    <div className="lwApp">

      {/* 
        This block displays the left sidebar.
        It stays visible for navigation between pages.
      */}
      <Sidebar />

      {/* 
        This block is the main right side of the screen.
        It contains the top bar and the page content.
      */}
      <div className="lwMain">

        {/* 
          This block displays the top bar at the top of the page.
          It usually contains buttons, profile, or controls.
        */}
        <TopBar />

        {/* 
          This block is the main page area where each page’s content appears.
        */}
        <div className="lwPage">

          {/* 
            This block shows the page header only if a title exists.
            If there is no title, this whole header is skipped.
          */}
          {title ? (
            <header className="lwPageHeader">

              {/* This shows the main title text */}
              <h1 className="lwPageTitle">{title}</h1>

              {/* 
                This shows the subtitle only if a subtitle exists.
                If there is no subtitle, nothing is shown here.
              */}
              {subtitle ? <p className="lwPageSubtitle">{subtitle}</p> : null}

            </header>
          ) : null}

          {/* 
            This block shows the actual content of the page.
            Whatever component is wrapped inside <Layout> will appear here.
          */}
          {children}

        </div>
      </div>
    </div>
  );
}
