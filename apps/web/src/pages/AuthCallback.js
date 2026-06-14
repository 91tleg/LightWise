// AuthCallback.jsx
import { useEffect } from "react";
import AuthScreen from "../components/AuthScreen";

export default function AuthCallback() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) {
      window.location.href = "/";
      return;
    }
    window.location.href = `${process.env.REACT_APP_API_BASE}/auth/callback?code=${code}`;
  }, []);

  return (
    <AuthScreen
      title="Signing you in..."
      message="Finishing your LightWise session."
    />
  );
}