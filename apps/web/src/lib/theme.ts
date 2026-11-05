import { useEffect, useState } from "react";
import type { ResolvedTheme, Theme } from "@eisenhower/shared";

const QUERY = "(prefers-color-scheme: dark)";

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

/**
 * Track the OS color scheme so the `system` theme follows it live.
 */
export function useSystemTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(readSystemTheme);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    setTheme(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return theme;
}

export function resolveTheme(
  preference: Theme,
  systemTheme: ResolvedTheme
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

/**
 * Paint the resolved theme onto <body> so the CSS variables switch.
 */
export function applyTheme(resolved: ResolvedTheme, preference: Theme): void {
  const body = document.body;
  body.dataset.theme = resolved;
  body.dataset.themePreference = preference;
}
