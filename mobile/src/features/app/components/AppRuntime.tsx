import { useAuthBootstrap } from "../../auth/hooks/useAuthBootstrap";
import { useSessionsOverviewSync } from "../../sessions/hooks/useSessionsOverview";

export function AppRuntime() {
  useAuthBootstrap();
  useSessionsOverviewSync();
  return null;
}
