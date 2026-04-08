import type { ReactNode } from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";

type AppRouterProps = {
  children: ReactNode;
};

function shouldUseHashRouter() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.protocol === "file:" ||
    "HybridWebView" in window ||
    window.location.hostname === "0.0.0.0"
  );
}

export function AppRouter({ children }: AppRouterProps) {
  if (shouldUseHashRouter()) {
    return <HashRouter>{children}</HashRouter>;
  }

  return <BrowserRouter>{children}</BrowserRouter>;
}
