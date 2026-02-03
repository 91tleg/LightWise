import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Overview from "./pages/Overview";
import MapView from "./pages/Map_View";
import Admin from "./pages/Admin";

export default function App() {


  return (

    // This is the main routing container for the application.
    <Routes>

      {/* 
        This route is for the root path "/".
        It displays the Login page.
      */}
      <Route path="/" element={<Login />} />

      {/* 
        This route displays the Overview dashboard page.
      */}
      <Route path="/overview" element={<Overview />} />

      {/* 
        This route displays the Map page.
      */}
      <Route path="/map" element={<MapView />} />

      {/* 
        This route displays the Admin page.
      */}
      <Route path="/admin" element={<Admin />} />

      {/* 
        This is the fallback route.
        If the user goes to any unknown path,
        they are automatically redirected back to the Login page.
      */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}
