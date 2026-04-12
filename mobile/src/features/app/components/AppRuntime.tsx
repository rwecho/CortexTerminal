import { useAuthBootstrap } from "../../auth/hooks/useAuthBootstrap";
import { useAuthSessionRefresh } from "../../auth/hooks/useAuthSessionRefresh";
import { useSessionsOverviewSync } from "../../sessions/hooks/useSessionsOverview";

export function AppRuntime() {
  useAuthBootstrap();
  useAuthSessionRefresh();
  useSessionsOverviewSync();
  return null;
}
