import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLightWise } from "../hooks/useLightWise";
import AuthScreen from "../components/AuthScreen";
import { redirectToSignIn, redirectToSignOut } from "../services/auth";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { completeAuthentication } = useLightWise();
  const [error, setError] = useState(null);
  const didStartRef = useRef(false);

  useEffect(() => {
    if (didStartRef.current) return;
    didStartRef.current = true;

    async function handleCallback() {
      try {
        const profile = await completeAuthentication();
        if (!profile) throw new Error("Unable to load operator profile");
        navigate("/overview", { replace: true });
      } catch (err) {
        console.error("AuthCallback failed:", err?.message, err?.status, err);
        setError(err?.message || "Sign-in failed");
      }
    }

    handleCallback();
  }, [completeAuthentication, navigate]);

  if (error) {
    return (
      <AuthScreen
        title="Sign-in failed"
        message={error}
        actionLabel="Try again"
        onAction={async () => {
          try { await redirectToSignOut(); } catch {}
          await redirectToSignIn();
        }}
      />
    );
  }

  return <AuthScreen title="Signing you in..." />;
}
