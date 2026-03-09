import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Analytics from "./pages/Analytics";
import MapView from "./pages/Map_View";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/overview" element={<Overview />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/map" element={<MapView />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}