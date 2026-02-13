import React from "react";

export default function Card({ title, children, className = "" }) {
  return (
    <section className={`lwCard ${className}`.trim()}>
      {title ? <div className="lwCardTitle">{title}</div> : null}
      {children}
    </section>
  );
}
