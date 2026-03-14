import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/lightwise.css";

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function guessRoleFromClaims(claims) {
  if (!claims || typeof claims !== "object") return "operator";

  const groups = claims["cognito:groups"];
  if (Array.isArray(groups) && groups.some((g) => String(g).toLowerCase() === "admin")) {
    return "admin";
  }

  const role =
    claims.role ||
    claims["custom:role"] ||
    claims["https://lightwise/role"] ||
    "operator";

  return String(role).toLowerCase();
}

const COGNITO_LOGIN_URL =
  "https://us-east-1oh1wtluxw.auth.us-east-1.amazoncognito.com/login" +
  "?client_id=641bkc2g21ggnkd4g22khvo7cg" +
  "&redirect_uri=http://localhost:3001/overview" +
  "&response_type=code" +
  "&scope=email+openid+phone";

export default function Login({ mode = "page" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("idle");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const code = params.get("code");
  const error = params.get("error");

  useEffect(() => {
    async function handleCallback() {
      if (mode !== "callback") return;
      if (!code) return;

      setStatus("exchanging");

      try {
        const body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: "641bkc2g21ggnkd4g22khvo7cg",
          code,
          redirect_uri: "http://localhost:3001/overview",
        });

        const response = await fetch(
          "https://us-east-1oh1wtluxw.auth.us-east-1.amazoncognito.com/oauth2/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          }
        );

        if (!response.ok) {
          throw new Error(`Token exchange failed: ${response.status}`);
        }

        const tokens = await response.json();
        const idToken = tokens?.id_token || "";
        const accessToken = tokens?.access_token || "";
        const claims = parseJwt(idToken);
        const role = guessRoleFromClaims(claims);

        const name =
          claims?.name ||
          [claims?.given_name, claims?.family_name].filter(Boolean).join(" ") ||
          "Operator";

        const email = claims?.email || "operator@lightwise.local";

        sessionStorage.setItem(
          "lightwise_auth",
          JSON.stringify({
            isAuthenticated: true,
            role,
            idToken,
            accessToken,
          })
        );

        sessionStorage.setItem(
          "lightwise_operator",
          JSON.stringify({
            name,
            email,
            role,
          })
        );

        if (role === "admin") {
          navigate("/admin", { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch (err) {
        console.error("Login callback failed:", err);
        setStatus("error");
      }
    }

    handleCallback();
  }, [mode, code, navigate]);

  function startLogin() {
    window.location.href = COGNITO_LOGIN_URL;
  }

  if (mode === "callback") {
    return (
      <div className="lwLoginCallback">
        <div className="lwLoginCallbackCard">
          <img
            src="/images/lightwise-transparent-motto.png"
            alt="LightWise"
            className="lwLoginCallbackBrand"
          />
          <div className="lwLoginCallbackTitle">
            {error
              ? "Login failed. Please try again."
              : status === "exchanging"
              ? "Signing you in…"
              : status === "error"
              ? "Token exchange failed. Please try again."
              : "Waiting for login response…"}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="lwRailPopoverAction"
              onClick={() => navigate("/login", { replace: true })}
              style={{
                width: "100%",
                justifyContent: "center",
                borderRadius: 14,
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                fontWeight: 800,
              }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lwLoginCallback">
      <div className="lwLoginCallbackCard">
        <img
          src="/images/lightwise-transparent-motto.png"
          alt="LightWise"
          className="lwLoginCallbackBrand"
        />
        <div className="lwLoginCallbackTitle">Sign in to LightWise</div>

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="lwRailPopoverAction"
            onClick={startLogin}
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
            Continue with Cognito
          </button>
        </div>
      </div>
    </div>
  );
}
