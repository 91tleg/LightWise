import React from "react";

export default function Card({ title, actions, children, className = "" }) {
  return (
    <section className={`lwCard ${className}`.trim()}>
      {title || actions ? (
        <div className="lwCardHeader">
          {title ? <div className="lwCardTitle">{title}</div> : null}
          {actions ? <div className="lwCardActions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
