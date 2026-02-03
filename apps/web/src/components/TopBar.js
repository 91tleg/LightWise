import React from "react";

export default function TopBar() {

  return (

    // This is the main container for the top bar of the application
    <header className="lwTopbar">

      {/* 
        This block is the left side of the top bar.
        It displays the LightWise brand images (logo and motto).
      */}
      <div className="lwTopbarBrand">

        {/* 
          This block shows the LightWise logo image.
          It is wrapped in a badge container for styling.
        */}
        <div className="lwTopbarBadge">
          <img
            src="/images/lightwise-logo.jpeg"
            alt="LightWise"
            className="lwTopbarImg"
          />
        </div>

        {/* 
          This block shows the LightWise motto image.
          It is displayed next to the logo.
        */}
        <div className="lwTopbarBadge">
          <img
            src="/images/lightwise-motto.jpeg"
            alt="LightWise Motto"
            className="lwTopbarImg"
          />
        </div>
      </div>

      {/* 
        This block is the right side of the top bar.
        It contains action buttons like notifications and profile.
      */}
      <div className="lwTopbarActions">

        {/* 
          This button represents the notifications action.
          In the future, it can open a notifications panel.
        */}
        <button className="lwTopbarIconBtn" title="Notifications">
          🔔
        </button>

        {/* 
          This button represents the user profile action.
          In the future, it can open a profile menu.
        */}
        <button className="lwTopbarIconBtn" title="Profile">
          👤
        </button>

      </div>
    </header>
  );
}
