import React from "react";

export default function SkeletonValue({ active, value }) {
  if (active) return <span className="lwSkeletonLine" aria-hidden="true" />;
  return <span className="lwSensorValue">{value}</span>;
}
