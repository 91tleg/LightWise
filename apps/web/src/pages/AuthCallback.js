import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { LIGHTWISE_ENV } from "../config/env";
import { useLightWise } from "../hooks/useLightWise";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { completeAuthentication } = useLightWise();
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      navigate("/", { replace: true });
      return () => { active = false; };
    }

    async function finishSignIn() {
      try {
        const response = await fetch(`${LIGHTWISE_ENV.API_BASE}/auth/callback?code=${encodeURIComponent(code)}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          throw Object.assign(new Error("Token exchange failed."), { status: response.status });
        }

        const profile = await completeAuthentication();
        if (!active) return;

        if (!profile) {
          throw new Error("Session cookies were not accepted by the browser.");
        }

        navigate("/overview", { replace: true });
      } catch (err) {
        if (active) setError(err);
      }
    }

    finishSignIn();

    return () => {
      active = false;
    };
  }, [completeAuthentication, navigate]);

  if (error) {
    return (
      <AuthScreen
        title="Unable to finish sign-in"
        message="The login completed, but LightWise could not start your session."
        actionLabel="Try again"
        onAction={() => {
          setError(null);
          navigate("/", { replace: true });
        }}
      />
    );
  }

  return (
    <AuthScreen
      title="Signing you in..."
      message="Finishing your LightWise session."
    />
  );
}
