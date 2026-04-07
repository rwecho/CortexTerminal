import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BottomNavigation } from "./BottomNavigation";
import { parseAppRoute, buildAppPath } from "../app/routeUtils";
import type { View } from "../app/appTypes";
import { useTerminalStore } from "../terminal/store/useTerminalStore";
import { useSessionsStore } from "../sessions/store/useSessionsStore";

export function BottomNavigationContainer() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = parseAppRoute(location.pathname).view;
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );

  const handleSelect = useCallback(
    (view: View) => {
      if (view === "terminal") {
        if (!activeSessionId) {
          setManagementError(
            "当前没有可打开的会话，请先创建或选择一个 session。",
          );
          navigate(buildAppPath("home"), { replace: true });
          return;
        }

        navigate(buildAppPath("terminal", activeSessionId));
        return;
      }

      navigate(buildAppPath(view));
    },
    [activeSessionId, navigate, setManagementError],
  );

  if (activeView === "terminal") {
    return null;
  }

  return <BottomNavigation activeView={activeView} onSelect={handleSelect} />;
}
