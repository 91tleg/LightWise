// This component displays a small statistics card that shows an icon,
// a label, a main value, and an optional note, used to present key metrics on the dashboard.

import React from "react";

export default function StatCard({ icon, label, value, note }) {
  return (
    <div className="lwKpiCard">
      <div className="lwKpiIcon">{icon}</div>
      <div className="lwKpiText">
        <div className="lwKpiLabel">{label}</div>
        <div className="lwKpiValue">{value}</div>
        {note ? <div className="lwKpiNote">{note}</div> : null}
      </div>
      <div className="lwKpiDot" />
    </div>
  );
}
