"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for theme management (light/dark mode).
 * Default is light mode. Persists preference to localStorage.
 */
export function useTheme() {
  const [theme, setTheme] = useState("light");

  // Load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem("mkv-converter-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    }
  }, []);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    localStorage.setItem("mkv-converter-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return { theme, toggleTheme };
}
