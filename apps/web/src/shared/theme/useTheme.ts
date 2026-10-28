import { useCallback, useSyncExternalStore } from "react";

/**
 * Color theme of the app.
 */
export type Theme = "light" | "dark";

/**
 * Key of the saved theme in `localStorage`; `public/theme-init.js` reads the same key.
 */
const STORAGE_KEY = "motorix-theme";

const listeners: Set<() => void> = new Set();

/**
 * Reads the theme currently applied to the document.
 *
 * @returns The theme.
 */
function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Applies a theme to the document and saves it.
 *
 * @param theme - Theme to apply.
 */
function writeTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    return;
  } finally {
    listeners.forEach((listener) => listener());
  }
}

/**
 * Subscribes a component to theme changes.
 *
 * @param listener - Called after each change.
 * @returns A function that removes the subscription.
 */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Light and dark theme of the app, saved in `localStorage` and shared by every component.
 *
 * @returns The current theme, a toggle and a setter.
 */
export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (theme: Theme) => void } {
  const theme: Theme = useSyncExternalStore(subscribe, readTheme, () => "light");
  const toggle = useCallback(() => writeTheme(readTheme() === "dark" ? "light" : "dark"), []);
  return { theme, toggle, setTheme: writeTheme };
}
