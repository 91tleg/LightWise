import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Analytics from "./pages/Analytics";
import MapView from "./pages/Map_View";
import Admin from "./pages/Admin";
import { LightWiseProvider } from "./context/LightWiseProvider";

export default function App() {
  return (
    <LightWiseProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LightWiseProvider>
  );
}