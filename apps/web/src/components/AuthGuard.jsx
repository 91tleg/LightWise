import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { useLightWise } from "../hooks/useLightWise";

function useAuthGuard() {
  const { authStatus, ensureAuthenticated, isAuthenticated, redirectToSignIn } = useLightWise();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) return;

    let active = true;

    (async () => {
      try {
        const profile = await ensureAuthenticated();
        if (!active || profile) return;
        await redirectToSignIn();
      } catch (err) {
        try {
          await redirectToSignIn();
        } catch (redirectErr) {
          if (active) setError(redirectErr || err);
        }
      }
    })();

    return () => { active = false; };
  }, [ensureAuthenticated, isAuthenticated, redirectToSignIn]);

  return { authStatus, isAuthenticated, error, setError, redirectToSignIn };
}

export function HostedUiEntryRoute() {
  const navigate = useNavigate();
  const { authStatus, isAuthenticated, error, setError, redirectToSignIn } = useAuthGuard();

  useEffect(() => {
    if (isAuthenticated) navigate("/overview", { replace: true });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated || authStatus === "authenticated") {
    return <Navigate to="/overview" replace />;
  }

  if (error) {
    return (
      <AuthScreen
        title="Unable to start sign-in"
        message="Error signing in. Please try again later."
        actionLabel="Try again"
        onAction={() => { setError(null); void redirectToSignIn(); }}
      />
    );
  }

  return (
    <AuthScreen
      title="Redirecting to sign in..."
      message="Checking your LightWise session."
    />
  );
}

export function ProtectedRoute({ children }) {
  const { authStatus, isAuthenticated, error, setError, redirectToSignIn } = useAuthGuard();

  if (isAuthenticated || authStatus === "authenticated") return children;

  if (error) {
    return (
      <AuthScreen
        title="Unable to restore session"
        message="Error signing in. Please try again later."
        actionLabel="Try again"
        onAction={() => { setError(null); void redirectToSignIn(); }}
      />
    );
  }

  return (
    <AuthScreen
      title="Redirecting to sign in..."
      message="This route requires an active LightWise session."
    />
  );
}
