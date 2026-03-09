import React from "react";

export default function Legend({ title = "Map Key", compact = false }) {
  return (
    <div className={compact ? "lwLegendCard lwLegendCompact" : "lwLegendCard"}>
      <div className="lwLegendTitle">{title}</div>
      <div className="lwLegendRow">
        <span className="lwDot green" />
        <span>Healthy</span>
      </div>
      <div className="lwLegendRow">
        <span className="lwDot amber" />
        <span>Warning</span>
      </div>
      <div className="lwLegendRow">
        <span className="lwDot red" />
        <span>Critical</span>
      </div>
      <div className="lwLegendRow">
        <span className="lwDot blue pulse" />
        <span>Motion detected</span>
      </div>
    </div>
  );
}