import "../styles/lightwise.css";

export default function AuthScreen({ title, message, actionLabel, onAction }) {
  return (
    <div className="lwLoginCallback">
      <div className="lwLoginCallbackCard">
        <img
          src="/images/lightwise-transparent-motto.png"
          alt="LightWise"
          className="lwLoginCallbackBrand"
        />

        <div className="lwLoginCallbackTitle">{title}</div>

        {message ? (
          <p
            style={{
              marginTop: 12,
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            {message}
          </p>
        ) : null}

        {actionLabel && onAction ? (
          <div style={{ marginTop: 18, width: "100%" }}>
            <button
              type="button"
              className="lwRailPopoverAction"
              onClick={onAction}
              style={{
                width: "100%",
                justifyContent: "center",
                borderRadius: 14,
                background: "linear-gradient(135deg, #0d73a8, #1bb0a3)",
                color: "#fff",
                fontWeight: 900,
                padding: "12px 16px",
              }}
            >
              {actionLabel}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
