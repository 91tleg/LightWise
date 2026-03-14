import { useEffect, useState } from "react";

const THEME_MODE_KEY = "lightwise_theme_mode";

function getAutoDarkMode() {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 7;
}

function readThemeMode() {
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY);
    if (saved === "light" || saved === "dark" || saved === "auto") {
      return saved;
    }
  } catch {}

  return "auto";
}

function getInitialDarkMode(themeMode) {
  if (themeMode === "light") return false;
  if (themeMode === "dark") return true;
  return getAutoDarkMode();
}

export function useDarkMode() {
  const [themeMode, setThemeMode] = useState(() => readThemeMode());
  const [darkMode, setDarkMode] = useState(() => getInitialDarkMode(readThemeMode()));

  useEffect(() => {
    try {
      localStorage.setItem(THEME_MODE_KEY, themeMode);
    } catch {}

    if (themeMode === "light") {
      setDarkMode(false);
      return undefined;
    }

    if (themeMode === "dark") {
      setDarkMode(true);
      return undefined;
    }

    const applyAuto = () => {
      setDarkMode(getAutoDarkMode());
    };

    applyAuto();
    const interval = window.setInterval(applyAuto, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [themeMode]);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    document.body.classList.toggle("light", !darkMode);
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return {
    darkMode,
    setDarkMode,
    themeMode,
    setThemeMode,
  };
}
