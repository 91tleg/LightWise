import React from "react";

export default function BubbleCard({
  icon,
  title,
  sub,
  pills = [],
  children,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}) {
  return (
    <div className="lwBubbleCard">
      <div className="lwBubbleTop">
        <div className="lwBubbleIcon">{icon}</div>
        <div>
          <div className="lwBubbleTitle">{title}</div>
          <div className="lwBubbleSub">{sub}</div>
        </div>
      </div>

      {pills?.length ? (
        <div className="lwBubblePills">
          {pills.map((p) => (
            <span key={p} className="lwBubblePill">
              {p}
            </span>
          ))}
        </div>
      ) : null}

      {children}

      {(primaryLabel || secondaryLabel) && (
        <div className="lwBubbleBtnRow">
          {primaryLabel ? (
            <button className="lwBubbleBtn" onClick={onPrimary}>
              {primaryLabel}
            </button>
          ) : null}
          {secondaryLabel ? (
            <button className="lwBubbleBtn ghost" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
