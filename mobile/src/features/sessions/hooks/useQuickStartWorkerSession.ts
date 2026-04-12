import { useCallback } from "react";
import type { GatewayWorker } from "../../../lib/gatewayManagementClient";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useManagementClient } from "../../app/hooks/useManagementClient";
import {
  getAgentLabel,
  getPathLabel,
  getPreferredWorkerAgentFamily,
} from "../../app/appUtils";
import { useSessionsStore } from "../store/useSessionsStore";
import { useLoadManagementData } from "./useSessionsOverview";
import { useOpenSessionAction } from "./useSessionActions";

function getQuickStartWorkingDirectory(worker: GatewayWorker) {
  return worker.availablePaths[0] ?? "~";
}

function getQuickStartDisplayName(workingDirectory: string, agentFamily: ReturnType<typeof getPreferredWorkerAgentFamily>) {
  return `${getPathLabel(workingDirectory)} · ${getAgentLabel(agentFamily)}`;
}

export function useQuickStartWorkerSession() {
  const managementClient = useManagementClient();
  const loadManagementData = useLoadManagementData();
  const handleAuthFailure = useAuthFailureHandler();
  const openSession = useOpenSessionAction();
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const setIsQuickStartingWorkerId = useSessionsStore(
    (state) => state.setIsQuickStartingWorkerId,
  );
  const setOverviewData = useSessionsStore((state) => state.setOverviewData);

  return useCallback(
    async (worker: GatewayWorker) => {
      if (!worker.isOnline) {
        return;
      }

      const workingDirectory = getQuickStartWorkingDirectory(worker);
      const agentFamily = getPreferredWorkerAgentFamily(worker);

      try {
        setIsQuickStartingWorkerId(worker.workerId);
        setManagementError(null);

        const session = await managementClient.createSession({
          workerId: worker.workerId,
          workingDirectory,
          displayName: getQuickStartDisplayName(workingDirectory, agentFamily),
          agentFamily,
        });

        const currentState = useSessionsStore.getState();
        const nextSessions = currentState.sessions.some(
          (candidate) => candidate.sessionId === session.sessionId,
        )
          ? currentState.sessions
          : [session, ...currentState.sessions];

        setOverviewData(currentState.workers, nextSessions);
        openSession(session);
        await loadManagementData({
          showLoading: false,
          preserveError: true,
        });
      } catch (error) {
        const message = (error as Error).message;
        if (!handleAuthFailure(message)) {
          setManagementError(message);
        }
      } finally {
        setIsQuickStartingWorkerId(null);
      }
    },
    [
      handleAuthFailure,
      loadManagementData,
      managementClient,
      openSession,
      setIsQuickStartingWorkerId,
      setManagementError,
      setOverviewData,
    ],
  );
}
