import type { ReactNode } from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { shouldUseStartupHashRouter } from "../../native/startup/nativeStartup";

type AppRouterProps = {
  children: ReactNode;
};

export function AppRouter({ children }: AppRouterProps) {
  if (shouldUseStartupHashRouter()) {
    return <HashRouter>{children}</HashRouter>;
  }

  return <BrowserRouter>{children}</BrowserRouter>;
}
