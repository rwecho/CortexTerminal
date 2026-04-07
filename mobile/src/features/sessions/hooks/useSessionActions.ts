import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type {
  GatewaySession,
  GatewayWorker,
} from "../../../lib/gatewayManagementClient";
import { buildAppPath } from "../../app/routeUtils";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useLoadManagementData } from "./useSessionsOverview";
import { useManagementClient } from "../../app/hooks/useManagementClient";
import { useSessionsStore } from "../store/useSessionsStore";
import { useTerminalStore } from "../../terminal/store/useTerminalStore";
import {
  agentOptions,
  buildSessionBootLogs,
  createTraceId,
  getPathLabel,
  inferAgentFamily,
} from "../../app/appUtils";
import { buildSessionAccessError } from "../../terminal/terminalUtils";

export function useNewSessionDraftSync() {
  const workers = useSessionsStore((state) => state.workers);
  const newSessionAgentFamily = useSessionsStore(
    (state) => state.newSessionAgentFamily,
  );
  const newSessionWorkerId = useSessionsStore(
    (state) => state.newSessionWorkerId,
  );
  const setNewSessionAgentFamily = useSessionsStore(
    (state) => state.setNewSessionAgentFamily,
  );
  const setNewSessionWorkerId = useSessionsStore(
    (state) => state.setNewSessionWorkerId,
  );
  const newSessionPath = useSessionsStore((state) => state.newSessionPath);
  const setNewSessionPath = useSessionsStore(
    (state) => state.setNewSessionPath,
  );

  const availableAgentFamilies = useMemo(
    () => agentOptions.map((option) => option.id),
    [],
  );

  const filteredNewSessionWorkers = useMemo(
    () =>
      workers.filter(
        (worker) =>
          inferAgentFamily(worker.modelName) === newSessionAgentFamily &&
          worker.isOnline,
      ),
    [newSessionAgentFamily, workers],
  );

  const selectedNewSessionWorker = useMemo(
    () =>
      filteredNewSessionWorkers.find(
        (worker) => worker.workerId === newSessionWorkerId,
      ) ?? null,
    [filteredNewSessionWorkers, newSessionWorkerId],
  );

  useEffect(() => {
    if (availableAgentFamilies.length === 0) {
      setNewSessionAgentFamily("claude");
      return;
    }

    setNewSessionAgentFamily(
      availableAgentFamilies.includes(newSessionAgentFamily)
        ? newSessionAgentFamily
        : availableAgentFamilies[0],
    );
  }, [availableAgentFamilies, newSessionAgentFamily, setNewSessionAgentFamily]);

  useEffect(() => {
    if (
      newSessionWorkerId &&
      filteredNewSessionWorkers.some(
        (worker) => worker.workerId === newSessionWorkerId,
      )
    ) {
      return;
    }

    setNewSessionWorkerId(filteredNewSessionWorkers[0]?.workerId ?? "");
  }, [filteredNewSessionWorkers, newSessionWorkerId, setNewSessionWorkerId]);

  useEffect(() => {
    const nextAvailablePath = selectedNewSessionWorker?.availablePaths[0] ?? "";

    if (
      newSessionPath &&
      selectedNewSessionWorker?.availablePaths.includes(newSessionPath)
    ) {
      return;
    }

    setNewSessionPath(nextAvailablePath);
  }, [newSessionPath, selectedNewSessionWorker, setNewSessionPath]);

  return {
    availableAgentFamilies,
  };
}

function prepareTerminalSession(
  session: GatewaySession,
  worker: GatewayWorker | null,
  navigate: ReturnType<typeof useNavigate>,
) {
  const terminalState = useTerminalStore.getState();
  terminalState.resetTerminalInteraction();
  terminalState.setTraceId(createTraceId());
  terminalState.setActiveSessionId(session.sessionId);
  terminalState.setCurrentPath(session.workingDirectory ?? "/claude");
  terminalState.setConnectionState("idle");
  terminalState.setTerminalLogs(buildSessionBootLogs(session, worker));
  useSessionsStore.getState().setManagementError(null);
  navigate(buildAppPath("terminal", session.sessionId));
}

export function useOpenSessionAction() {
  const navigate = useNavigate();
  const workers = useSessionsStore((state) => state.workers);
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const setActiveSessionId = useTerminalStore(
    (state) => state.setActiveSessionId,
  );

  return useCallback(
    (session: GatewaySession) => {
      const worker =
        workers.find((candidate) => candidate.workerId === session.workerId) ??
        null;

      if (!worker?.isOnline) {
        setManagementError(buildSessionAccessError(session, worker));
        setActiveSessionId(session.sessionId);
        return;
      }

      prepareTerminalSession(session, worker, navigate);
    },
    [navigate, setActiveSessionId, setManagementError, workers],
  );
}

export function useSessionActions() {
  const managementClient = useManagementClient();
  const loadManagementData = useLoadManagementData();
  const handleAuthFailure = useAuthFailureHandler();
  const navigate = useNavigate();
  const openSession = useOpenSessionAction();
  const newSessionWorkerId = useSessionsStore(
    (state) => state.newSessionWorkerId,
  );
  const newSessionPath = useSessionsStore((state) => state.newSessionPath);
  const newSessionDisplayName = useSessionsStore(
    (state) => state.newSessionDisplayName,
  );
  const setIsCreatingSession = useSessionsStore(
    (state) => state.setIsCreatingSession,
  );
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const setNewSessionDisplayName = useSessionsStore(
    (state) => state.setNewSessionDisplayName,
  );
  const setIsDeletingSessionId = useSessionsStore(
    (state) => state.setIsDeletingSessionId,
  );
  const setIsDeletingWorkerId = useSessionsStore(
    (state) => state.setIsDeletingWorkerId,
  );
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);

  const handleCreateSession = useCallback(async () => {
    if (!newSessionWorkerId || !newSessionPath) {
      setManagementError("请选择 worker 和 path 后再创建 session。");
      return;
    }

    const traceId = createTraceId();
    const displayName =
      newSessionDisplayName.trim() || `${getPathLabel(newSessionPath)} session`;

    try {
      setIsCreatingSession(true);
      setManagementError(null);

      const session = await managementClient.createSession({
        workerId: newSessionWorkerId,
        workingDirectory: newSessionPath,
        displayName,
        traceId,
      });

      await loadManagementData();
      setNewSessionDisplayName("");
      openSession(session);
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setManagementError(message);
      }
    } finally {
      setIsCreatingSession(false);
    }
  }, [
    handleAuthFailure,
    loadManagementData,
    managementClient,
    newSessionDisplayName,
    newSessionPath,
    newSessionWorkerId,
    openSession,
    setIsCreatingSession,
    setManagementError,
    setNewSessionDisplayName,
  ]);

  const handleDeleteSession = useCallback(
    async (session: GatewaySession) => {
      try {
        setIsDeletingSessionId(session.sessionId);
        setManagementError(null);

        if (session.sessionId === activeSessionId) {
          navigate(buildAppPath("home"));
        }

        await managementClient.closeSession(session.sessionId);
        await loadManagementData();
      } catch (error) {
        const message = (error as Error).message;
        if (!handleAuthFailure(message)) {
          setManagementError(message);
        }
      } finally {
        setIsDeletingSessionId(null);
      }
    },
    [
      activeSessionId,
      handleAuthFailure,
      loadManagementData,
      managementClient,
      navigate,
      setIsDeletingSessionId,
      setManagementError,
    ],
  );

  const handleDeleteWorker = useCallback(
    async (worker: GatewayWorker) => {
      try {
        setIsDeletingWorkerId(worker.workerId);
        setManagementError(null);
        await managementClient.deleteWorker(worker.workerId);
        await loadManagementData();
      } catch (error) {
        const message = (error as Error).message;
        if (!handleAuthFailure(message)) {
          setManagementError(message);
        }
      } finally {
        setIsDeletingWorkerId(null);
      }
    },
    [
      handleAuthFailure,
      loadManagementData,
      managementClient,
      setIsDeletingWorkerId,
      setManagementError,
    ],
  );

  return {
    handleCreateSession,
    handleDeleteSession,
    handleDeleteWorker,
    openSession,
  };
}
