import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { useLightWise } from "../hooks/useLightWise";

function getCallbackErrorMessage(error, errorDescription) {
  if (errorDescription) {
    return decodeURIComponent(String(errorDescription).replace(/\+/g, " "));
  }

  if (error) {
    return `Cognito returned "${error}".`;
  }

  return "Sign-in did not complete. Redirecting back to Cognito.";
}

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeAuthentication, redirectToSignIn } = useLightWise();
  const [screen, setScreen] = useState({
    title: "Signing you in...",
    message: "Completing the Cognito code exchange.",
    actionLabel: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    let active = true;

    (async () => {
      if (error) {
        if (!active) return;
        setScreen({
          title: "Redirecting to sign in...",
          message: getCallbackErrorMessage(error, errorDescription),
          actionLabel: "",
        });
        await redirectToSignIn();
        return;
      }

      if (!code) {
        if (!active) return;
        setScreen({
          title: "Redirecting to sign in...",
          message: "No authorization code was returned to /callback.",
          actionLabel: "",
        });
        await redirectToSignIn();
        return;
      }

      try {
        await completeAuthentication();
        if (!active) return;
        window.history.replaceState(null, document.title, window.location.pathname);
        navigate("/overview", { replace: true });
      } catch (authError) {
        if (!active) return;
        setScreen({
          title: "Redirecting to sign in...",
          message: authError?.message || "Unable to complete authentication.",
          actionLabel: "",
        });
        await redirectToSignIn();
      }
    })();

    return () => {
      active = false;
    };
  }, [completeAuthentication, location.search, navigate, redirectToSignIn]);

  return (
    <AuthScreen
      title={screen.title}
      message={screen.message}
      actionLabel={screen.actionLabel}
    />
  );
}
