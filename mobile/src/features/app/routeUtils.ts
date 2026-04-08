import type { View } from "./appTypes";

export type ParsedAppRoute = {
  view: View;
  sessionId: string | null;
};

export function parseAppRoute(pathname: string): ParsedAppRoute {
  if (pathname.startsWith("/audit")) {
    return { view: "audit", sessionId: null };
  }

  if (pathname.startsWith("/settings/worker-auth")) {
    return { view: "workerAuth", sessionId: null };
  }

  if (pathname.startsWith("/settings")) {
    return { view: "settings", sessionId: null };
  }

  if (pathname.startsWith("/sessions/new")) {
    return { view: "newSession", sessionId: null };
  }

  if (pathname.startsWith("/sessions/")) {
    const sessionId = pathname.slice("/sessions/".length).split("/")[0];
    return {
      view: "terminal",
      sessionId: sessionId ? decodeURIComponent(sessionId) : null,
    };
  }

  return { view: "home", sessionId: null };
}

export function buildAppPath(view: View, sessionId?: string | null): string {
  switch (view) {
    case "newSession":
      return "/sessions/new";
    case "terminal":
      return sessionId ? `/sessions/${encodeURIComponent(sessionId)}` : "/";
    case "audit":
      return "/audit";
    case "settings":
      return "/settings";
    case "workerAuth":
      return "/settings/worker-auth";
    default:
      return "/";
  }
}
