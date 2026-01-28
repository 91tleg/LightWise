import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./App.css";
import "./styles/lightwise.css";


// ===== ROOT CREATION BLOCK =====
// This finds the main HTML element with id="root"
// and creates a React root where the whole app will be rendered.
const root = ReactDOM.createRoot(document.getElementById("root"));


// ===== APP RENDER BLOCK =====
// This renders the React application into the root element.
// - React.StrictMode helps detect potential problems during development.
// - BrowserRouter enables routing between pages.
// - App is the main application component.
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
