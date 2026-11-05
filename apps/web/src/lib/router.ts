import { useEffect, useState } from "react";

/**
 * The app ships as a static bundle (GitHub Pages + local desktop copy), so
 * routes live in the hash: `#/` is the board, `#/guide` is the feature tour.
 * Hash routing keeps deep links working without any server rewrite rules.
 */
export type Route = "board" | "guide";

const ROUTES: Record<string, Route> = {
  "": "board",
  "/": "board",
  "/board": "board",
  "/guide": "guide"
};

export function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#/, "");
  return ROUTES[path] ?? "board";
}

export function navigate(route: Route): void {
  const next = route === "board" ? "#/" : `#/${route}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === "undefined" ? "board" : routeFromHash(window.location.hash)
  );

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return route;
}
