import { Navigate, Route, Routes } from "react-router-dom";
import { LightWiseProvider } from "./context/LightWiseProvider";
import { HostedUiEntryRoute, ProtectedRoute } from "./components/AuthGuard";
import AuthCallback from "./pages/AuthCallback";
import Overview from "./pages/Overview";
import Analytics from "./pages/Analytics";
import MapView from "./pages/MapView";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <LightWiseProvider>
      <Routes>
        <Route path="/"          element={<HostedUiEntryRoute />} />
        <Route path="/callback"  element={<AuthCallback />} />
        <Route path="/overview"  element={<ProtectedRoute><Overview /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/map"       element={<ProtectedRoute><MapView /></ProtectedRoute>} />
        <Route path="/admin"     element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="*"          element={<ProtectedRoute><Navigate to="/overview" replace /></ProtectedRoute>} />
      </Routes>
    </LightWiseProvider>
  );
}
