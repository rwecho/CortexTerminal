import { useNavigate } from "react-router-dom";
import { HomePage } from "../HomePage";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useSessionsStore } from "../store/useSessionsStore";
import { useTerminalStore } from "../../terminal/store/useTerminalStore";
import { useSessionActions } from "../hooks/useSessionActions";
import { buildAppPath } from "../../app/routeUtils";

export function HomeRoute() {
  const navigate = useNavigate();
  const currentPrincipal = useAuthStore((state) => state.currentPrincipal);
  const managementError = useSessionsStore((state) => state.managementError);
  const isLoadingManagement = useSessionsStore(
    (state) => state.isLoadingManagement,
  );
  const sessions = useSessionsStore((state) => state.sessions);
  const workers = useSessionsStore((state) => state.workers);
  const isDeletingSessionId = useSessionsStore(
    (state) => state.isDeletingSessionId,
  );
  const isDeletingWorkerId = useSessionsStore(
    (state) => state.isDeletingWorkerId,
  );
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const { openSession, handleDeleteSession, handleDeleteWorker } =
    useSessionActions();

  return (
    <HomePage
      currentPrincipal={currentPrincipal}
      managementError={managementError}
      isLoadingManagement={isLoadingManagement}
      sessions={sessions}
      workers={workers}
      activeSessionId={activeSessionId}
      isDeletingSessionId={isDeletingSessionId}
      isDeletingWorkerId={isDeletingWorkerId}
      onOpenNewSession={() => navigate(buildAppPath("newSession"))}
      onOpenSession={openSession}
      onDeleteSession={handleDeleteSession}
      onDeleteWorker={handleDeleteWorker}
    />
  );
}
