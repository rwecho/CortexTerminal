import { useCallback, useEffect, useRef } from "react";
import { gatewayUrl } from "../../app/config";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useManagementClient } from "../../app/hooks/useManagementClient";
import { isNativeStartupRuntime } from "../../native/startup/nativeStartup";
import {
  configureNativeManagementRealtime,
  disconnectNativeManagementRealtime,
  getNativeBridgeSource,
} from "../../native/bridge/nativeBridge";
import { toUserFacingManagementError } from "../../app/appUtils";
import {
  useAuthStore,
  selectIsAppLoggedIn,
} from "../../auth/store/useAuthStore";
import { useSessionsStore } from "../store/useSessionsStore";
import { useTerminalStore } from "../../terminal/store/useTerminalStore";

type LoadManagementOptions = {
  showLoading?: boolean;
  preserveError?: boolean;
};

type NativeManagementEnvelope = {
  type?: string;
  payload?: {
    reason?: string;
    source?: string;
    state?: string;
    error?: string | null;
  };
};

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

  return useCallback(
    async (options: LoadManagementOptions = {}) => {
      const { showLoading = true, preserveError = false } = options;

      if (showLoading) {
        setIsLoadingManagement(true);
      }

      if (!preserveError) {
        setManagementError(null);
      }

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
          setManagementError(toUserFacingManagementError(message));
        }
      } finally {
        if (showLoading) {
          setIsLoadingManagement(false);
        }
      }
    },
    [
      handleAuthFailure,
      managementClient,
      setActiveSessionId,
      setIsLoadingManagement,
      setManagementError,
      setOverviewData,
    ],
  );
}

export function useSessionsOverviewSync() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAppLoggedIn = useAuthStore(selectIsAppLoggedIn);
  const hasLoadedManagementSnapshot = useSessionsStore(
    (state) => state.hasLoadedManagementSnapshot,
  );
  const loadManagementData = useLoadManagementData();
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const refreshTimeoutRef = useRef<number | null>(null);
  const isNativeRealtimeRuntime =
    isNativeStartupRuntime() || getNativeBridgeSource() === "native";

  const scheduleManagementRefresh = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      void loadManagementData({
        showLoading: false,
        preserveError: true,
      });
    }, 150);
  }, [loadManagementData]);

  const refreshManagementSnapshot = useCallback(() => {
    void loadManagementData({
      showLoading: false,
      preserveError: true,
    });
  }, [loadManagementData]);

  useEffect(() => {
    if (!isAppLoggedIn) {
      return;
    }

    void loadManagementData({
      showLoading: !hasLoadedManagementSnapshot,
    });
  }, [hasLoadedManagementSnapshot, isAppLoggedIn, loadManagementData]);

  useEffect(() => {
    if (!isAppLoggedIn || !accessToken) {
      return;
    }

    if (!isNativeRealtimeRuntime) {
      return;
    }

    const handleNativeManagementMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: unknown }>;
      const rawMessage = customEvent.detail?.message;

      if (!rawMessage) {
        return;
      }

      try {
        const data =
          typeof rawMessage === "string"
            ? (JSON.parse(rawMessage) as NativeManagementEnvelope)
            : (rawMessage as NativeManagementEnvelope);

        if (data.type === "managementInvalidated") {
          scheduleManagementRefresh();
          return;
        }

        if (data.type === "managementConnectionState") {
          if (data.payload?.state === "closed" && data.payload.error) {
            setManagementError(toUserFacingManagementError(data.payload.error));
          }

          if (
            data.payload?.state === "reconnected" ||
            data.payload?.state === "connected"
          ) {
            scheduleManagementRefresh();
          }
        }
      } catch {
        // Ignore unrelated raw native bridge messages.
      }
    };

    window.addEventListener(
      "HybridWebViewMessageReceived",
      handleNativeManagementMessage,
    );
    window.addEventListener(
      "CortexNativeManagementMessageReceived",
      handleNativeManagementMessage,
    );

    return () => {
      window.removeEventListener(
        "HybridWebViewMessageReceived",
        handleNativeManagementMessage,
      );
      window.removeEventListener(
        "CortexNativeManagementMessageReceived",
        handleNativeManagementMessage,
      );
    };
  }, [
    accessToken,
    isAppLoggedIn,
    isNativeRealtimeRuntime,
    scheduleManagementRefresh,
    setManagementError,
  ]);

  useEffect(() => {
    if (!isAppLoggedIn || !accessToken) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      refreshManagementSnapshot();
    };

    const handleWindowFocus = () => {
      refreshManagementSnapshot();
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pageshow", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pageshow", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accessToken, isAppLoggedIn, refreshManagementSnapshot]);

  useEffect(() => {
    if (!isAppLoggedIn || !accessToken) {
      return;
    }

    if (!isNativeRealtimeRuntime) {
      return () => {
        if (refreshTimeoutRef.current !== null) {
          window.clearTimeout(refreshTimeoutRef.current);
          refreshTimeoutRef.current = null;
        }
      };
    }

    void configureNativeManagementRealtime(gatewayUrl, accessToken).catch(
      (error: Error) => {
        if (!useSessionsStore.getState().managementError) {
          setManagementError(toUserFacingManagementError(error.message));
        }
      },
    );

    return () => {
      void disconnectNativeManagementRealtime();
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [accessToken, isAppLoggedIn, isNativeRealtimeRuntime, setManagementError]);
}
