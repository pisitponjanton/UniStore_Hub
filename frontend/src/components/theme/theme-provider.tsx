"use client";

import { useEffect, useSyncExternalStore, createContext, useContext, type ReactNode } from "react";

export type ThemePreference = "system" | "light" | "dark";
export const THEME_STORAGE_KEY = "unistore-theme";

function storedTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}

function applyTheme(preference: ThemePreference) {
  const resolved = preference === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
  document.documentElement.dataset.theme = resolved;
}

const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
function setPreference(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch { /* storage may be unavailable; current page can still switch */ }
  applyTheme(preference);
  listeners.forEach(listener => listener());
}

type ThemeContextValue = { preference: ThemePreference; setPreference: (value: ThemePreference) => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, storedTheme, () => "system");

  useEffect(() => {
    applyTheme(storedTheme());
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if (storedTheme() === "system") applyTheme("system"); };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      applyTheme(storedTheme());
      listeners.forEach(listener => listener());
    };
    media?.addEventListener?.("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener?.("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return <ThemeContext.Provider value={{ preference, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeSwitcher requires ThemeProvider");
  return value;
}
