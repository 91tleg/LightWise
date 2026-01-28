import React from "react";


// ===== COMPONENT DEFINITION BLOCK =====
// This defines a small component called Legend.
// This component only displays a visual guide (legend) for the map colors.
export default function Legend() {

  // ===== MAIN RETURN BLOCK =====
  // Everything inside return(...) is what will appear on the screen
  return (

    // This is the outer card that holds the whole legend box
    <div className="lwLegendCard">

      {/* 
        This block displays the title of the legend box.
        It simply shows the word "Legend" at the top.
      */}
      <div className="lwLegendTitle">Legend</div>

      {/* 
        This block shows one row of the legend:
        - a green dot
        - and the text "Normal / Dimmed"
        This explains what the green color means on the map.
      */}
      <div className="lwLegendRow">
        <span className="lwDot green" />
        <span>Normal / Dimmed</span>
      </div>

      {/* 
        This block shows another row of the legend:
        - a red dot
        - and the text "Fault"
        This explains what the red color means on the map.
      */}
      <div className="lwLegendRow">
        <span className="lwDot red" />
        <span>Fault</span>
      </div>

      {/* 
        This block shows another row of the legend:
        - a blue dot
        - and the text "Safety Active"
        This explains what the blue color means on the map.
      */}
      <div className="lwLegendRow">
        <span className="lwDot blue" />
        <span>Safety Active</span>
      </div>

    </div>
  );
}
