import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLightWise } from "../hooks/useLightWise";
import AuthScreen from "../components/AuthScreen";
import { getOperatorProfile } from "../services/api";
import { waitForIdToken, redirectToSignIn, redirectToSignOut } from "../services/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setOperator } = useLightWise();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const token = await waitForIdToken();
        const profile = await getOperatorProfile(token);
        setOperator(profile);
        navigate("/overview", { replace: true });
      } catch (err) {
        console.error("AuthCallback failed:", err?.message, err?.status, err);
        setError(err?.message || "Sign-in failed");
      }
    }

    handleCallback();
  }, [navigate, setOperator]);

  if (error) {
    return (
      <AuthScreen
        title="Sign-in failed"
        subtitle={error}
        action={{ label: "Try again", onClick: async () => {
          try { await redirectToSignOut(); } catch {}
          await redirectToSignIn();
        }}}
      />
    );
  }

  return <AuthScreen title="Signing you in..." />;
}
