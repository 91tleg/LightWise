import React from "react";

export default function Panel({ title, children, className = "" }) {
  return (
    <section className={`lwPanel ${className}`.trim()}>
      {title ? <div className="lwPanelTitle">{title}</div> : null}
      <div className="lwPanelBody">{children}</div>
    </section>
  );
}
