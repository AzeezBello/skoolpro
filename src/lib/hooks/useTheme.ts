"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "skoolpro-theme";

// Theme is a class on <html> set before paint by the root layout; this hook
// mirrors it into React state and watches for changes from any toggle.
export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((next: "dark" | "light") => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable; theme still applied for this page
    }
  }, []);

  const toggle = useCallback(() => setTheme(dark ? "light" : "dark"), [dark, setTheme]);

  return { dark, toggle, setTheme };
}
