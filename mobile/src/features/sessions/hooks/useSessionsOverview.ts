import { useCallback, useEffect, useMemo, useRef } from "react";
import { createManagementRealtimeClient } from "../../../lib/managementRealtimeClient";
import { gatewayUrl } from "../../app/config";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useManagementClient } from "../../app/hooks/useManagementClient";
import {
  useAuthStore,
  selectIsAppLoggedIn,
} from "../../auth/store/useAuthStore";
import { useSessionsStore } from "../store/useSessionsStore";
import { useTerminalStore } from "../../terminal/store/useTerminalStore";

export function useLoadManagementData() {
  const managementClient = useManagementClient();
  const handleAuthFailure = useAuthFailureHandler();
  const setIsLoadingManagement = useSessionsStore(
    (state) => state.setIsLoadingManagement,
  );
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const setOverviewData = useSessionsStore((state) => state.setOverviewData);
  const setActiveSessionId = useTerminalStore(
    (state) => state.setActiveSessionId,
  );

  return useCallback(async () => {
    setIsLoadingManagement(true);
    setManagementError(null);

    try {
      const [nextWorkers, nextSessions] = await Promise.all([
        managementClient.listWorkers(),
        managementClient.listSessions(),
      ]);

      setOverviewData(nextWorkers, nextSessions);
      const currentActiveSessionId =
        useTerminalStore.getState().activeSessionId;
      const nextActiveSessionId =
        currentActiveSessionId &&
        nextSessions.some(
          (session) => session.sessionId === currentActiveSessionId,
        )
          ? currentActiveSessionId
          : (nextSessions[0]?.sessionId ?? null);

      setActiveSessionId(nextActiveSessionId);
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setManagementError(message);
      }
    } finally {
      setIsLoadingManagement(false);
    }
  }, [
    handleAuthFailure,
    managementClient,
    setActiveSessionId,
    setIsLoadingManagement,
    setManagementError,
    setOverviewData,
  ]);
}

export function useSessionsOverviewSync() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAppLoggedIn = useAuthStore(selectIsAppLoggedIn);
  const loadManagementData = useLoadManagementData();
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const refreshTimeoutRef = useRef<number | null>(null);

  const scheduleManagementRefresh = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      void loadManagementData();
    }, 150);
  }, [loadManagementData]);

  const managementRealtimeClient = useMemo(
    () =>
      createManagementRealtimeClient(
        gatewayUrl,
        () => accessToken,
        scheduleManagementRefresh,
        scheduleManagementRefresh,
      ),
    [accessToken, scheduleManagementRefresh],
  );

  useEffect(() => {
    if (!isAppLoggedIn) {
      return;
    }

    void loadManagementData();
  }, [isAppLoggedIn, loadManagementData]);

  useEffect(() => {
    if (!isAppLoggedIn || !accessToken) {
      return;
    }

    void managementRealtimeClient.connect().catch((error: Error) => {
      if (!useSessionsStore.getState().managementError) {
        setManagementError(error.message);
      }
    });

    return () => {
      void managementRealtimeClient.disconnect();
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [
    accessToken,
    isAppLoggedIn,
    managementRealtimeClient,
    setManagementError,
  ]);
}
