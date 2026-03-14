import React from "react";

export default function MetricRow({ label, value, tone = "neutral" }) {
  return (
    <div className="lwMetricRow">
      <span>{label}</span>
      <span className={`lwMetricBadge ${tone}`}>{value}</span>
    </div>
  );
}
