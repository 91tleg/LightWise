import React from "react";

export default function PillRow({ pills = [], className = "" }) {
  if (!pills.length) return null;

  return (
    <div className={`lwPillRow ${className}`.trim()}>
      {pills.map((p) => (
        <span key={p.label} className={`lwPill ${p.color || ""}`.trim()}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
