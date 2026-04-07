import { useNavigate } from "react-router-dom";
import { NewSessionPage } from "../NewSessionPage";
import { useSessionsStore } from "../store/useSessionsStore";
import {
  useNewSessionDraftSync,
  useSessionActions,
} from "../hooks/useSessionActions";
import { buildAppPath } from "../../app/routeUtils";

export function NewSessionRoute() {
  const navigate = useNavigate();
  const workers = useSessionsStore((state) => state.workers);
  const selectedAgentFamily = useSessionsStore(
    (state) => state.newSessionAgentFamily,
  );
  const selectedWorkerId = useSessionsStore(
    (state) => state.newSessionWorkerId,
  );
  const selectedPath = useSessionsStore((state) => state.newSessionPath);
  const sessionDisplayName = useSessionsStore(
    (state) => state.newSessionDisplayName,
  );
  const isCreatingSession = useSessionsStore(
    (state) => state.isCreatingSession,
  );
  const managementError = useSessionsStore((state) => state.managementError);
  const setNewSessionAgentFamily = useSessionsStore(
    (state) => state.setNewSessionAgentFamily,
  );
  const setNewSessionWorkerId = useSessionsStore(
    (state) => state.setNewSessionWorkerId,
  );
  const setNewSessionPath = useSessionsStore(
    (state) => state.setNewSessionPath,
  );
  const setNewSessionDisplayName = useSessionsStore(
    (state) => state.setNewSessionDisplayName,
  );
  const { availableAgentFamilies } = useNewSessionDraftSync();
  const { handleCreateSession } = useSessionActions();

  return (
    <NewSessionPage
      workers={workers}
      selectedAgentFamily={selectedAgentFamily}
      availableAgentFamilies={availableAgentFamilies}
      selectedWorkerId={selectedWorkerId}
      selectedPath={selectedPath}
      sessionDisplayName={sessionDisplayName}
      isCreatingSession={isCreatingSession}
      managementError={managementError}
      onBack={() => navigate(buildAppPath("home"))}
      onAgentFamilyChange={setNewSessionAgentFamily}
      onWorkerChange={setNewSessionWorkerId}
      onPathChange={setNewSessionPath}
      onSessionDisplayNameChange={setNewSessionDisplayName}
      onCreateSession={handleCreateSession}
    />
  );
}
