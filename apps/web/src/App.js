import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AuthScreen from "./components/AuthScreen";
import { LightWiseProvider } from "./context/LightWiseProvider";
import { useLightWise } from "./hooks/useLightWise";
import Analytics from "./pages/Analytics";
import AuthCallback from "./pages/AuthCallback";
import Admin from "./pages/Admin";
import MapView from "./pages/Map_View";
import Overview from "./pages/Overview";

function HostedUiEntryRoute() {
  const navigate = useNavigate();
  const { authStatus, ensureAuthenticated, isAuthenticated, redirectToSignIn } = useLightWise();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      return undefined;
    }

    let active = true;

    (async () => {
      try {
        const profile = await ensureAuthenticated();
        if (!active) return;

        if (profile) {
          navigate("/overview", { replace: true });
          return;
        }

        await redirectToSignIn();
      } catch (authError) {
        if (!active) return;
        setError(authError);
      }
    })();

    return () => {
      active = false;
    };
  }, [ensureAuthenticated, isAuthenticated, navigate, redirectToSignIn]);

  if (isAuthenticated || authStatus === "authenticated") {
    return <Navigate to="/overview" replace />;
  }

  if (error) {
    return (
      <AuthScreen
        title="Unable to start sign-in"
        message={error?.message || "We couldn't restore your session."}
        actionLabel="Try again"
        onAction={() => {
          setError(null);
          void redirectToSignIn();
        }}
      />
    );
  }

  return (
    <AuthScreen
      title="Redirecting to sign in..."
      message="Checking your LightWise session and opening Cognito if needed."
    />
  );
}

function ProtectedRoute({ children }) {
  const { authStatus, ensureAuthenticated, isAuthenticated, redirectToSignIn } = useLightWise();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      return undefined;
    }

    let active = true;

    (async () => {
      try {
        const profile = await ensureAuthenticated();
        if (!active) return;

        if (profile) {
          return;
        }

        await redirectToSignIn();
      } catch (authError) {
        if (!active) return;
        setError(authError);
      }
    })();

    return () => {
      active = false;
    };
  }, [ensureAuthenticated, isAuthenticated, redirectToSignIn]);

  if (isAuthenticated || authStatus === "authenticated") {
    return children;
  }

  if (error) {
    return (
      <AuthScreen
        title="Unable to restore session"
        message={error?.message || "We couldn't finish authentication."}
        actionLabel="Try again"
        onAction={() => {
          setError(null);
          void redirectToSignIn();
        }}
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

export default function App() {
  return (
    <LightWiseProvider>
      <Routes>
        <Route path="/" element={<HostedUiEntryRoute />} />
        <Route path="/callback" element={<AuthCallback />} />
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <Overview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigate to="/overview" replace />
            </ProtectedRoute>
          }
        />
      </Routes>
    </LightWiseProvider>
  );
}
