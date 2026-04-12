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
  allAgentFamilies,
  buildSessionBootLogs,
  createTraceId,
  doesWorkerSupportAgentFamily,
  getWorkerSupportedAgentFamilies,
  isPathWithinRoots,
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

  const availableAgentFamilies = useMemo(() => {
    const onlineWorkers = workers.filter((worker) => worker.isOnline);
    const families = onlineWorkers.flatMap((worker) =>
      getWorkerSupportedAgentFamilies(worker),
    );

    return families.length > 0
      ? allAgentFamilies.filter((agentFamily) => families.includes(agentFamily))
      : [...allAgentFamilies];
  }, [workers]);

  const filteredNewSessionWorkers = useMemo(
    () => workers.filter((worker) => worker.isOnline),
    [workers],
  );

  const selectedNewSessionWorker = useMemo(
    () =>
      filteredNewSessionWorkers.find(
        (worker) => worker.workerId === newSessionWorkerId,
      ) ?? null,
    [filteredNewSessionWorkers, newSessionWorkerId],
  );

  useEffect(() => {
    const supportedAgentFamilies = selectedNewSessionWorker
      ? getWorkerSupportedAgentFamilies(selectedNewSessionWorker)
      : availableAgentFamilies;

    if (supportedAgentFamilies.length === 0) {
      setNewSessionAgentFamily("claude");
      return;
    }

    setNewSessionAgentFamily(
      supportedAgentFamilies.includes(newSessionAgentFamily)
        ? newSessionAgentFamily
        : supportedAgentFamilies[0],
    );
  }, [
    availableAgentFamilies,
    newSessionAgentFamily,
    selectedNewSessionWorker,
    setNewSessionAgentFamily,
  ]);

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

    if ((selectedNewSessionWorker?.availablePaths.length ?? 0) === 0) {
      return;
    }

    if (
      newSessionPath &&
      isPathWithinRoots(newSessionPath, selectedNewSessionWorker.availablePaths)
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
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const setActiveSessionId = useTerminalStore(
    (state) => state.setActiveSessionId,
  );

  return useCallback(
    (session: GatewaySession) => {
      const workers = useSessionsStore.getState().workers;
      const worker =
        workers.find((candidate) => candidate.workerId === session.workerId) ??
        null;

      if (!worker) {
        setManagementError(buildSessionAccessError(session, worker));
        setActiveSessionId(session.sessionId);
        return;
      }

      prepareTerminalSession(session, worker, navigate);
    },
    [navigate, setActiveSessionId, setManagementError],
  );
}

export function useSessionActions() {
  const managementClient = useManagementClient();
  const loadManagementData = useLoadManagementData();
  const handleAuthFailure = useAuthFailureHandler();
  const navigate = useNavigate();
  const openSession = useOpenSessionAction();
  const newSessionAgentFamily = useSessionsStore(
    (state) => state.newSessionAgentFamily,
  );
  const newSessionWorkerId = useSessionsStore(
    (state) => state.newSessionWorkerId,
  );
  const newSessionPath = useSessionsStore((state) => state.newSessionPath);
  const setIsCreatingSession = useSessionsStore(
    (state) => state.setIsCreatingSession,
  );
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const setIsDeletingSessionId = useSessionsStore(
    (state) => state.setIsDeletingSessionId,
  );
  const setIsDeletingWorkerId = useSessionsStore(
    (state) => state.setIsDeletingWorkerId,
  );
  const setOverviewData = useSessionsStore((state) => state.setOverviewData);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);

  const handleCreateSession = useCallback(async () => {
    const hasConfiguredPath = newSessionPath.trim().length > 0;
    const selectedWorker = useSessionsStore
      .getState()
      .workers.find((worker) => worker.workerId === newSessionWorkerId && worker.isOnline);

    if (!newSessionWorkerId || !hasConfiguredPath || !selectedWorker) {
      setManagementError("请选择 worker 和 path 后再创建 session。");
      return;
    }

    if (!doesWorkerSupportAgentFamily(selectedWorker, newSessionAgentFamily)) {
      setManagementError(
        `当前节点不支持 ${newSessionAgentFamily}，请切换到兼容的 worker。`,
      );
      return;
    }

    const traceId = createTraceId();

    try {
      setIsCreatingSession(true);
      setManagementError(null);

      const session = await managementClient.createSession({
        workerId: newSessionWorkerId,
        workingDirectory: newSessionPath,
        agentFamily: newSessionAgentFamily,
        traceId,
      });

      const currentState = useSessionsStore.getState();
      const nextSessions = currentState.sessions.some(
        (candidate) => candidate.sessionId === session.sessionId,
      )
        ? currentState.sessions
        : [...currentState.sessions, session];

      setOverviewData(currentState.workers, nextSessions);
      await loadManagementData({
        showLoading: false,
        preserveError: true,
      });

      const refreshedState = useSessionsStore.getState();
      const resolvedSession =
        refreshedState.sessions.find(
          (candidate) => candidate.sessionId === session.sessionId,
        ) ?? session;

      window.location.assign(buildAppPath("terminal", resolvedSession.sessionId));
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
    newSessionAgentFamily,
    newSessionPath,
    newSessionWorkerId,
    setOverviewData,
    setIsCreatingSession,
    setManagementError,
  ]);

  const handleDeleteSession = useCallback(
    async (session: GatewaySession) => {
      const currentState = useSessionsStore.getState();
      const previousWorkers = currentState.workers;
      const previousSessions = currentState.sessions;
      const nextSessions = previousSessions.filter(
        (candidate) => candidate.sessionId !== session.sessionId,
      );

      try {
        setIsDeletingSessionId(session.sessionId);
        setManagementError(null);
        setOverviewData(previousWorkers, nextSessions);

        if (session.sessionId === activeSessionId) {
          navigate(buildAppPath("home"));
        }

        await managementClient.closeSession(session.sessionId);
        await loadManagementData({
          showLoading: false,
          preserveError: true,
        });
      } catch (error) {
        setOverviewData(previousWorkers, previousSessions);
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
      setOverviewData,
      setManagementError,
    ],
  );

  const handleDeleteWorker = useCallback(
    async (worker: GatewayWorker) => {
      const currentState = useSessionsStore.getState();
      const previousWorkers = currentState.workers;
      const previousSessions = currentState.sessions;
      const nextWorkers = previousWorkers.filter(
        (candidate) => candidate.workerId !== worker.workerId,
      );
      const nextSessions = previousSessions.filter(
        (session) => session.workerId !== worker.workerId,
      );

      try {
        setIsDeletingWorkerId(worker.workerId);
        setManagementError(null);
        setOverviewData(nextWorkers, nextSessions);
        await managementClient.deleteWorker(worker.workerId);
        await loadManagementData({
          showLoading: false,
          preserveError: true,
        });
      } catch (error) {
        setOverviewData(previousWorkers, previousSessions);
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
      setOverviewData,
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
