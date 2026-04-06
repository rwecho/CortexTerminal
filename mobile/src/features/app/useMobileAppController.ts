import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  createGatewayManagementClient,
  type GatewayAuditEntry,
  type GatewaySession,
  type GatewayWorker,
} from "../../lib/gatewayManagementClient";
import { createManagementRealtimeClient } from "../../lib/managementRealtimeClient";
import {
  createGatewayAuthClient,
  type GatewayPrincipal,
} from "../../lib/gatewayAuthClient";
import { createRelayClient } from "../../lib/relayClient";
import {
  appendTerminalTranscript,
  detectTerminalInteraction,
  type TerminalInteraction,
  type TerminalInteractionAction,
} from "../terminal/interactionDetector";
import type { AgentFamily, LogItem, View } from "./appTypes";
import {
  agentOptions,
  buildSessionBootLogs,
  createRequestId,
  createTraceId,
  getPathLabel,
  inferAgentFamily,
  isAuthFailure,
} from "./appUtils";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const gatewayTokenStorageKey = "cortex-terminal.gateway.accessToken";

type ParsedAppRoute = {
  view: View;
  sessionId: string | null;
};

function parseAppRoute(pathname: string): ParsedAppRoute {
  if (pathname.startsWith("/audit")) {
    return { view: "audit", sessionId: null };
  }

  if (pathname.startsWith("/settings/pair-worker")) {
    return { view: "pairWorker", sessionId: null };
  }

  if (pathname.startsWith("/settings")) {
    return { view: "settings", sessionId: null };
  }

  if (pathname.startsWith("/sessions/new")) {
    return { view: "newSession", sessionId: null };
  }

  if (pathname.startsWith("/sessions/")) {
    const sessionId = pathname.slice("/sessions/".length).split("/")[0];
    return {
      view: "terminal",
      sessionId: sessionId ? decodeURIComponent(sessionId) : null,
    };
  }

  return { view: "home", sessionId: null };
}

function buildAppPath(view: View, sessionId?: string | null): string {
  switch (view) {
    case "newSession":
      return "/sessions/new";
    case "terminal":
      return sessionId ? `/sessions/${encodeURIComponent(sessionId)}` : "/";
    case "audit":
      return "/audit";
    case "settings":
      return "/settings";
    case "pairWorker":
      return "/settings/pair-worker";
    default:
      return "/";
  }
}

function buildSessionAccessError(
  session: GatewaySession,
  worker: GatewayWorker | null,
) {
  if (!session.workerId) {
    return "当前会话还没有绑定 worker，无法打开终端。\nThis session is not bound to a worker yet.";
  }

  if (!worker) {
    return `会话绑定的 worker ${session.workerId} 不存在或已被清理。\nWorker ${session.workerId} no longer exists.`;
  }

  const heartbeatText = worker.lastHeartbeatAtUtc
    ? `最后心跳 ${new Date(worker.lastHeartbeatAtUtc).toLocaleString()}`
    : "尚未收到有效心跳";

  return `节点 ${worker.displayName} 当前离线，无法打开该会话。请先恢复 worker 连接，或将会话重新绑定到在线节点。\n${heartbeatText}`;
}

export function useMobileAppController() {
  const gatewayUrl =
    import.meta.env.VITE_GATEWAY_BASE_URL ?? "http://localhost:5050";
  const initialRoute =
    typeof window === "undefined"
      ? { view: "home" as View, sessionId: null }
      : parseAppRoute(window.location.pathname);
  const [activeView, setActiveViewState] = useState<View>(initialRoute.view);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentPrincipal, setCurrentPrincipal] =
    useState<GatewayPrincipal | null>(null);
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [workerPairingCode, setWorkerPairingCode] = useState("");
  const [workerPairingError, setWorkerPairingError] = useState<string | null>(
    null,
  );
  const [workerPairingMessage, setWorkerPairingMessage] = useState<
    string | null
  >(null);
  const [isApprovingWorkerPairing, setIsApprovingWorkerPairing] =
    useState(false);
  const [currentPath, setCurrentPath] = useState("/claude");
  const [inputValue, setInputValue] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [isPressing, setIsPressing] = useState(false);
  const [traceId, setTraceId] = useState(createTraceId());
  const [connectionState, setConnectionState] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [workers, setWorkers] = useState<GatewayWorker[]>([]);
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [auditEntries, setAuditEntries] = useState<GatewayAuditEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialRoute.sessionId,
  );
  const [isLoadingManagement, setIsLoadingManagement] = useState(false);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [newSessionAgentFamily, setNewSessionAgentFamily] =
    useState<AgentFamily>("claude");
  const [newSessionWorkerId, setNewSessionWorkerId] = useState("");
  const [newSessionPath, setNewSessionPath] = useState("");
  const [newSessionDisplayName, setNewSessionDisplayName] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(
    null,
  );
  const [isDeletingWorkerId, setIsDeletingWorkerId] = useState<string | null>(
    null,
  );
  const [terminalLogs, setTerminalLogs] = useState<LogItem[]>(
    buildSessionBootLogs(null, null),
  );
  const [terminalInteraction, setTerminalInteraction] =
    useState<TerminalInteraction | null>(null);
  const [isInteractionCustomInputVisible, setIsInteractionCustomInputVisible] =
    useState(false);

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const flushedLogIndexRef = useRef(0);
  const activeViewRef = useRef<View>(activeView);
  const activeSessionRef = useRef<GatewaySession | null>(null);
  const traceIdRef = useRef(traceId);
  const terminalTranscriptRef = useRef("");
  const managementRefreshTimeoutRef = useRef<number | null>(null);

  const authClient = useMemo(
    () => createGatewayAuthClient(gatewayUrl),
    [gatewayUrl],
  );

  const managementClient = useMemo(
    () => createGatewayManagementClient(gatewayUrl, () => accessToken),
    [accessToken, gatewayUrl],
  );

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeWorker = useMemo(
    () =>
      workers.find((worker) => worker.workerId === activeSession?.workerId) ??
      null,
    [activeSession?.workerId, workers],
  );

  const isAppLoggedIn = Boolean(accessToken && currentPrincipal);

  const setActiveView = useCallback(
    (
      nextView: View,
      options?: { sessionId?: string | null; replace?: boolean },
    ) => {
      const targetSessionId =
        options?.sessionId ??
        (nextView === "terminal"
          ? (activeSessionRef.current?.sessionId ?? activeSessionId)
          : null);

      if (typeof window !== "undefined") {
        const nextPath = buildAppPath(nextView, targetSessionId);
        if (window.location.pathname !== nextPath) {
          if (options?.replace) {
            window.history.replaceState(
              { view: nextView, sessionId: targetSessionId },
              "",
              nextPath,
            );
          } else {
            window.history.pushState(
              { view: nextView, sessionId: targetSessionId },
              "",
              nextPath,
            );
          }
        }
      }

      setActiveViewState(nextView);
    },
    [activeSessionId],
  );

  const availableAgentFamilies = useMemo(() => {
    return agentOptions.map((option) => option.id);
  }, []);

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

  const showInteractionComposer =
    Boolean(terminalInteraction) && isInteractionCustomInputVisible;
  const shouldHideDefaultComposer =
    Boolean(terminalInteraction) && !showInteractionComposer;

  const updateTerminalInteraction = useCallback((nextText: string) => {
    terminalTranscriptRef.current = appendTerminalTranscript(
      terminalTranscriptRef.current,
      nextText,
    );

    const nextInteraction = detectTerminalInteraction(
      terminalTranscriptRef.current,
    );

    setTerminalInteraction((currentInteraction) => {
      if (
        currentInteraction?.signature === nextInteraction?.signature &&
        currentInteraction?.prompt === nextInteraction?.prompt
      ) {
        return currentInteraction;
      }

      if (
        !nextInteraction ||
        currentInteraction?.signature !== nextInteraction.signature
      ) {
        setIsInteractionCustomInputVisible(false);
      }

      return nextInteraction;
    });
  }, []);

  const resetTerminalInteraction = useCallback(() => {
    terminalTranscriptRef.current = "";
    setTerminalInteraction(null);
    setIsInteractionCustomInputVisible(false);
  }, []);

  const focusCommandInput = useCallback(() => {
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });
  }, []);

  const relayClient = useMemo(
    () =>
      createRelayClient(
        gatewayUrl,
        (sessionId, payload, metadata) => {
          if (sessionId !== activeSessionRef.current?.sessionId) {
            return;
          }

          const text = decoder.decode(payload);

          if (text.startsWith("__ct_ready__:")) {
            const path = text.slice("__ct_ready__:".length).trim();
            setCurrentPath(
              path.length > 0
                ? path
                : (activeSessionRef.current?.workingDirectory ?? "/claude"),
            );
            setConnectionState("connected");
            setTerminalLogs((prev) => [
              ...prev,
              {
                type: "system",
                text: `Session ready${path ? `: ${path}` : ""}`,
              },
            ]);
            return;
          }

          if (text.startsWith("__ct_cwd__:")) {
            const lines = text.split("\n");
            const path = lines[0]?.slice("__ct_cwd__:".length).trim();
            if (path) {
              setCurrentPath(path);
            }

            const remainingText = lines.slice(1).join("\n");
            if (remainingText.trim().length > 0) {
              updateTerminalInteraction(remainingText);
              setTerminalLogs((prev) => [
                ...prev,
                { type: "ai", text: remainingText },
              ]);
            }

            return;
          }

          if (text.startsWith("__ct_error__:")) {
            const errorText = text.slice("__ct_error__:".length).trim();
            setConnectionState("error");
            setTerminalLogs((prev) => [
              ...prev,
              { type: "system", text: `Worker error: ${errorText}` },
            ]);
            return;
          }

          if (!text) {
            return;
          }

          updateTerminalInteraction(text);

          if (xtermRef.current && activeViewRef.current === "terminal") {
            xtermRef.current.write(text);
            return;
          }

          const requestText = metadata.requestId
            ? ` req=${metadata.requestId}`
            : "";
          const traceText = metadata.traceId
            ? ` trace=${metadata.traceId}`
            : "";
          setTerminalLogs((prev) => [
            ...prev,
            { type: "ai", text: `${requestText}${traceText}${text}` },
          ]);
        },
        () => accessToken,
      ),
    [accessToken, gatewayUrl, updateTerminalInteraction],
  );

  const clearAuthentication = useCallback(() => {
    window.localStorage.removeItem(gatewayTokenStorageKey);
    setAccessToken(null);
    setCurrentPrincipal(null);
    setWorkers([]);
    setSessions([]);
    setAuditEntries([]);
    setActiveSessionId(null);
    setManagementError(null);
    setAuditError(null);
    setConnectionState("idle");
    setWorkerPairingCode("");
    setWorkerPairingError(null);
    setWorkerPairingMessage(null);
    setNewSessionWorkerId("");
    setNewSessionPath("");
    setNewSessionDisplayName("");
    setNewSessionAgentFamily("claude");
    resetTerminalInteraction();
  }, [resetTerminalInteraction]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      const route = parseAppRoute(window.location.pathname);
      setActiveViewState(route.view);
      if (route.view === "terminal") {
        setActiveSessionId(route.sessionId);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const applyAuthentication = useCallback(
    (token: string, principal: GatewayPrincipal) => {
      window.localStorage.setItem(gatewayTokenStorageKey, token);
      setAccessToken(token);
      setCurrentPrincipal(principal);
      setAuthError(null);
      setManagementError(null);
    },
    [],
  );

  const handleAuthenticate = useCallback(async () => {
    const username = authUsername.trim();
    const password = authPassword;

    if (!username || !password) {
      setAuthError(
        "请输入用户名和密码。\nPlease provide both username and password.",
      );
      return;
    }

    try {
      setIsAuthenticating(true);
      setAuthError(null);

      if (authMode === "register") {
        await authClient.register({
          username,
          password,
          displayName: authDisplayName.trim() || undefined,
          email: authEmail.trim() || undefined,
        });
      }

      const tokenResponse = await authClient.login(username, password);
      const principal = await authClient.me(tokenResponse.access_token);
      applyAuthentication(tokenResponse.access_token, principal);
    } catch (error) {
      setAuthError((error as Error).message);
    } finally {
      setIsAuthenticating(false);
    }
  }, [
    applyAuthentication,
    authClient,
    authDisplayName,
    authEmail,
    authMode,
    authPassword,
    authUsername,
  ]);

  const handleSignOut = useCallback(async () => {
    await relayClient.disconnect().catch(() => undefined);
    clearAuthentication();
    setActiveView("home");
    setCurrentPath("/claude");
    setTerminalLogs(buildSessionBootLogs(null, null));
  }, [clearAuthentication, relayClient]);

  const handleApproveWorkerPairing = useCallback(async () => {
    const normalizedCode = workerPairingCode.trim().toUpperCase();
    if (!accessToken || !normalizedCode) {
      setWorkerPairingError(
        "请输入 worker pairing code。\nPlease enter the worker pairing code.",
      );
      return;
    }

    try {
      setIsApprovingWorkerPairing(true);
      setWorkerPairingError(null);
      setWorkerPairingMessage(null);

      const result = await authClient.activateWorkerDevice(
        accessToken,
        normalizedCode,
      );
      setWorkerPairingMessage(
        `Worker ${result.displayName} (${result.workerId}) 已授权，可在节点侧继续启动。`,
      );
      setWorkerPairingCode("");
    } catch (error) {
      const message = (error as Error).message;
      if (isAuthFailure(message)) {
        clearAuthentication();
        setAuthError(
          "登录已过期，请重新登录。\nYour session expired. Please sign in again.",
        );
      } else {
        setWorkerPairingError(message);
      }
    } finally {
      setIsApprovingWorkerPairing(false);
    }
  }, [accessToken, authClient, clearAuthentication, workerPairingCode]);

  const loadManagementData = useCallback(async () => {
    setIsLoadingManagement(true);
    setManagementError(null);

    try {
      const [nextWorkers, nextSessions] = await Promise.all([
        managementClient.listWorkers(),
        managementClient.listSessions(),
      ]);

      setWorkers(nextWorkers);
      setSessions(nextSessions);
      setActiveSessionId((currentActiveSessionId) => {
        if (
          currentActiveSessionId &&
          nextSessions.some(
            (session) => session.sessionId === currentActiveSessionId,
          )
        ) {
          return currentActiveSessionId;
        }

        return nextSessions[0]?.sessionId ?? null;
      });
    } catch (error) {
      const message = (error as Error).message;

      if (isAuthFailure(message)) {
        clearAuthentication();
        setAuthError(
          "登录已过期，请重新登录。\nYour session expired. Please sign in again.",
        );
      } else {
        setManagementError(message);
      }
    } finally {
      setIsLoadingManagement(false);
    }
  }, [clearAuthentication, managementClient]);

  const loadAuditEntries = useCallback(async () => {
    setIsLoadingAudit(true);
    setAuditError(null);

    try {
      const nextEntries = await managementClient.listAuditEntries(120);
      setAuditEntries(nextEntries);
    } catch (error) {
      const message = (error as Error).message;

      if (isAuthFailure(message)) {
        clearAuthentication();
        setAuthError(
          "登录已过期，请重新登录。\nYour session expired. Please sign in again.",
        );
      } else {
        setAuditError(message);
      }
    } finally {
      setIsLoadingAudit(false);
    }
  }, [clearAuthentication, managementClient]);

  const scheduleManagementRefresh = useCallback(() => {
    if (managementRefreshTimeoutRef.current !== null) {
      window.clearTimeout(managementRefreshTimeoutRef.current);
    }

    managementRefreshTimeoutRef.current = window.setTimeout(() => {
      managementRefreshTimeoutRef.current = null;
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
    [accessToken, gatewayUrl, scheduleManagementRefresh],
  );

  useEffect(() => {
    const storedToken = window.localStorage.getItem(gatewayTokenStorageKey);
    if (!storedToken) {
      setIsAuthBootstrapping(false);
      return;
    }

    void authClient
      .me(storedToken)
      .then((principal) => {
        applyAuthentication(storedToken, principal);
      })
      .catch(() => {
        clearAuthentication();
      })
      .finally(() => {
        setIsAuthBootstrapping(false);
      });
  }, [applyAuthentication, authClient, clearAuthentication]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    traceIdRef.current = traceId;
  }, [traceId]);

  useEffect(() => {
    if (!isAppLoggedIn) {
      return;
    }

    void loadManagementData();
  }, [isAppLoggedIn, loadManagementData]);

  useEffect(() => {
    if (!isAppLoggedIn || activeView !== "audit") {
      return;
    }

    void loadAuditEntries();
  }, [activeView, isAppLoggedIn, loadAuditEntries]);

  useEffect(() => {
    if (!isAppLoggedIn || !accessToken) {
      return;
    }

    void managementRealtimeClient.connect().catch((error: Error) => {
      setManagementError((current) => current ?? error.message);
    });

    return () => {
      void managementRealtimeClient.disconnect();
      if (managementRefreshTimeoutRef.current !== null) {
        window.clearTimeout(managementRefreshTimeoutRef.current);
        managementRefreshTimeoutRef.current = null;
      }
    };
  }, [accessToken, isAppLoggedIn, managementRealtimeClient]);

  useEffect(() => {
    if (!activeSession) {
      setCurrentPath("/claude");
      resetTerminalInteraction();
      return;
    }

    setCurrentPath(activeSession.workingDirectory ?? "/claude");
  }, [activeSession, resetTerminalInteraction]);

  useEffect(() => {
    if (availableAgentFamilies.length === 0) {
      setNewSessionAgentFamily("claude");
      return;
    }

    setNewSessionAgentFamily((currentFamily) =>
      availableAgentFamilies.includes(currentFamily)
        ? currentFamily
        : availableAgentFamilies[0],
    );
  }, [availableAgentFamilies]);

  useEffect(() => {
    setNewSessionWorkerId((currentWorkerId) => {
      if (
        currentWorkerId &&
        filteredNewSessionWorkers.some(
          (worker) => worker.workerId === currentWorkerId,
        )
      ) {
        return currentWorkerId;
      }

      return filteredNewSessionWorkers[0]?.workerId ?? "";
    });
  }, [filteredNewSessionWorkers]);

  useEffect(() => {
    const nextAvailablePath = selectedNewSessionWorker?.availablePaths[0] ?? "";

    setNewSessionPath((currentPathValue) => {
      if (
        currentPathValue &&
        selectedNewSessionWorker?.availablePaths.includes(currentPathValue)
      ) {
        return currentPathValue;
      }

      return nextAvailablePath;
    });
  }, [selectedNewSessionWorker]);

  useLayoutEffect(() => {
    if (activeView !== "terminal" || !activeSession) {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }

      fitAddonRef.current = null;
      flushedLogIndexRef.current = 0;
      return;
    }

    let disposed = false;
    let mountFrameId = 0;
    let fitFrameId = 0;

    const mountTerminal = () => {
      if (disposed || xtermRef.current) {
        return;
      }

      const terminalHostElement = terminalHostRef.current;
      if (!terminalHostElement) {
        mountFrameId = requestAnimationFrame(mountTerminal);
        return;
      }

      const xterm = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "Menlo, Monaco, Consolas, 'Courier New', monospace",
        theme: {
          background: "#000000",
          foreground: "#d1d5db",
          cursor: "#22c55e",
          black: "#0b0f10",
          green: "#00ff41",
          cyan: "#22d3ee",
        },
      });
      const fitAddon = new FitAddon();

      xterm.loadAddon(fitAddon);
      xterm.open(terminalHostElement);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;
      flushedLogIndexRef.current = 0;

      for (let i = 0; i < terminalLogs.length; i += 1) {
        const log = terminalLogs[i];
        const rendered =
          log.type === "system"
            ? `# ${log.text}`
            : log.type === "command"
              ? `❯ ${log.text}`
              : log.text;

        if (log.type === "ai") {
          xterm.write(rendered);
        } else {
          rendered.split("\n").forEach((line) => xterm.writeln(line));
        }
      }

      flushedLogIndexRef.current = terminalLogs.length;
      fitAddon.fit();
      fitFrameId = requestAnimationFrame(() => fitAddonRef.current?.fit());
    };

    mountFrameId = requestAnimationFrame(mountTerminal);

    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(mountFrameId);
      cancelAnimationFrame(fitFrameId);
      window.removeEventListener("resize", handleResize);

      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }

      fitAddonRef.current = null;
      flushedLogIndexRef.current = 0;
    };
  }, [activeSession, activeView, terminalLogs]);

  useEffect(() => {
    if (activeView !== "terminal" || !xtermRef.current) {
      return;
    }

    const term = xtermRef.current;

    for (let i = flushedLogIndexRef.current; i < terminalLogs.length; i += 1) {
      const log = terminalLogs[i];
      const rendered =
        log.type === "system"
          ? `# ${log.text}`
          : log.type === "command"
            ? `❯ ${log.text}`
            : log.text;

      if (log.type === "ai") {
        term.write(rendered);
      } else {
        rendered.split("\n").forEach((line) => term.writeln(line));
      }
    }

    flushedLogIndexRef.current = terminalLogs.length;
    fitAddonRef.current?.fit();
  }, [terminalLogs, activeView]);

  useEffect(
    () => () => {
      relayClient.disconnect().catch(() => undefined);
      managementRealtimeClient.disconnect().catch(() => undefined);

      if (managementRefreshTimeoutRef.current !== null) {
        window.clearTimeout(managementRefreshTimeoutRef.current);
        managementRefreshTimeoutRef.current = null;
      }

      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    },
    [managementRealtimeClient, relayClient],
  );

  const connectCurrentSession = useCallback(
    async (targetSession?: GatewaySession | null, targetTraceId?: string) => {
      if (!targetSession?.workerId) {
        const message =
          "当前会话还没有绑定 worker，无法建立 terminal relay。\nThis session is not bound to a worker yet.";
        setConnectionState("error");
        setManagementError(message);
        setTerminalLogs((prev) => [
          ...prev,
          {
            type: "system",
            text: message,
          },
        ]);
        return false;
      }

      const boundWorker =
        workers.find((worker) => worker.workerId === targetSession.workerId) ??
        null;

      if (!boundWorker?.isOnline) {
        const message = buildSessionAccessError(targetSession, boundWorker);
        setConnectionState("error");
        setManagementError(message);
        setTerminalLogs((prev) => [
          ...prev,
          {
            type: "system",
            text: message,
          },
        ]);
        return false;
      }

      const effectiveTraceId = targetTraceId ?? traceIdRef.current;

      try {
        setConnectionState("connecting");
        setManagementError(null);

        if (relayClient.isConnected()) {
          await relayClient.disconnect();
        }

        await relayClient.connect(
          targetSession.sessionId,
          targetSession.workerId,
        );
        setCurrentPath(targetSession.workingDirectory ?? "/claude");
        setTerminalLogs((prev) => [
          ...prev,
          {
            type: "system",
            text: `Relay connected: gateway=${gatewayUrl}, session=${targetSession.sessionId}, worker=${targetSession.workerId}, trace=${effectiveTraceId}`,
          },
        ]);

        await relayClient.sendMobileFrame(
          targetSession.sessionId,
          encoder.encode("__ct_init__"),
          {
            requestId: `sys-init-${Date.now()}`,
            traceId: effectiveTraceId,
          },
        );

        return true;
      } catch (error) {
        const message = (error as Error).message;

        if (isAuthFailure(message)) {
          await relayClient.disconnect().catch(() => undefined);
          clearAuthentication();
          setAuthError(
            "终端连接鉴权已失效，请重新登录。\nTerminal relay authorization expired. Please sign in again.",
          );
          return false;
        }

        const displayMessage = message.includes("offline")
          ? `节点 ${boundWorker.displayName} 当前离线，无法连接该会话。`
          : message.includes("not allowed")
            ? `该会话配置的工作目录不被当前 worker 允许，请重新选择目录或更换节点。\n${message}`
            : `打开会话失败：${message}`;

        setConnectionState("error");
        setManagementError(displayMessage);
        setTerminalLogs((prev) => [
          ...prev,
          {
            type: "system",
            text: displayMessage,
          },
        ]);
        return false;
      }
    },
    [clearAuthentication, gatewayUrl, relayClient, workers],
  );

  useEffect(() => {
    if (activeView !== "terminal" || !activeSessionId || isLoadingManagement) {
      return;
    }

    const routedSession = sessions.find(
      (session) => session.sessionId === activeSessionId,
    );

    if (!routedSession) {
      setActiveView("home", { replace: true });
      setManagementError(
        "目标会话不存在、已被删除，或当前用户无权访问该会话。",
      );
      return;
    }

    if (connectionState === "idle" && !relayClient.isConnected()) {
      void connectCurrentSession(routedSession, traceIdRef.current);
    }
  }, [
    activeSessionId,
    activeView,
    connectCurrentSession,
    connectionState,
    isLoadingManagement,
    relayClient,
    sessions,
    setActiveView,
  ]);

  const disconnectCurrentServer = useCallback(async () => {
    await relayClient.disconnect();
    setConnectionState("idle");
    resetTerminalInteraction();
    setTerminalLogs((prev) => [
      ...prev,
      { type: "system", text: "Disconnected from gateway relay." },
    ]);
  }, [relayClient, resetTerminalInteraction]);

  const ensureTerminalConnection = useCallback(async (): Promise<
    { ok: true; session: GatewaySession; traceId: string } | { ok: false }
  > => {
    const currentSession = activeSessionRef.current;
    if (!currentSession) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "system", text: "请先创建或选择一个 session。" },
      ]);
      return { ok: false };
    }

    if (connectionState === "connected" && relayClient.isConnected()) {
      return { ok: true, session: currentSession, traceId: traceIdRef.current };
    }

    if (connectionState === "connecting") {
      return { ok: false };
    }

    const connected = await connectCurrentSession(
      currentSession,
      traceIdRef.current,
    );
    if (!connected) {
      return { ok: false };
    }

    return { ok: true, session: currentSession, traceId: traceIdRef.current };
  }, [connectCurrentSession, connectionState, relayClient]);

  const openSession = useCallback(
    async (session: GatewaySession) => {
      const worker =
        workers.find((candidate) => candidate.workerId === session.workerId) ??
        null;

      if (!worker?.isOnline) {
        setManagementError(buildSessionAccessError(session, worker));
        setActiveSessionId(session.sessionId);
        return;
      }

      const nextTraceId = createTraceId();
      resetTerminalInteraction();
      setTraceId(nextTraceId);
      setManagementError(null);
      setActiveSessionId(session.sessionId);
      setCurrentPath(session.workingDirectory ?? "/claude");
      setTerminalLogs(buildSessionBootLogs(session, worker));
      setActiveView("terminal", { sessionId: session.sessionId });
      await connectCurrentSession(session, nextTraceId);
    },
    [connectCurrentSession, resetTerminalInteraction, setActiveView, workers],
  );

  const rebindCurrentSession = useCallback(
    async (session: GatewaySession) => {
      setConnectionState("connecting");
      setTerminalLogs((prev) => [
        ...prev,
        {
          type: "system",
          text: `Session rebind requested: session=${session.sessionId}, worker=${session.workerId ?? "unbound"}`,
        },
      ]);

      return connectCurrentSession(session, traceIdRef.current);
    },
    [connectCurrentSession],
  );

  const sendCommand = useCallback(
    async (
      command: string,
      options?: { displayText?: string; clearInteraction?: boolean },
    ) => {
      const isEscapeCommand = command === "\u001b";
      const isEnterCommand = command === "\n";

      if (!command.trim() && !isEscapeCommand && !isEnterCommand) {
        return;
      }

      if (options?.clearInteraction ?? true) {
        setTerminalInteraction(null);
        setIsInteractionCustomInputVisible(false);
      }

      const connection = await ensureTerminalConnection();

      if (!connection.ok) {
        setTerminalLogs((prev) => [
          ...prev,
          {
            type: "system",
            text: "Relay 正在连接中，请稍候再发送。",
          },
        ]);
        return;
      }

      const requestId = createRequestId();
      const displayText =
        options?.displayText ??
        (isEscapeCommand ? "<Esc>" : isEnterCommand ? "<Enter>" : command);

      setTerminalLogs((prev) => [
        ...prev,
        {
          type: "command",
          text: displayText,
        },
      ]);

      try {
        await relayClient.sendMobileFrame(
          connection.session.sessionId,
          encoder.encode(command),
          {
            requestId,
            traceId: connection.traceId,
          },
        );
      } catch (error) {
        const errorMessage = (error as Error).message;

        if (errorMessage.includes("is not bound to a worker")) {
          try {
            const rebound = await rebindCurrentSession(connection.session);
            if (!rebound) {
              return;
            }

            await relayClient.sendMobileFrame(
              connection.session.sessionId,
              encoder.encode(command),
              {
                requestId,
                traceId: connection.traceId,
              },
            );
            return;
          } catch (retryError) {
            setConnectionState("error");
            setTerminalLogs((prev) => [
              ...prev,
              {
                type: "system",
                text: `Session rebind failed: ${(retryError as Error).message}`,
              },
            ]);
            return;
          }
        }

        setTerminalLogs((prev) => [
          ...prev,
          { type: "system", text: `Send failed: ${errorMessage}` },
        ]);
      }
    },
    [ensureTerminalConnection, rebindCurrentSession, relayClient],
  );

  const handleTerminalInteractionAction = useCallback(
    async (action: TerminalInteractionAction) => {
      if (action.kind === "focus-input") {
        setIsInteractionCustomInputVisible(true);
        focusCommandInput();
        return;
      }

      if (!action.sendText) {
        return;
      }

      await sendCommand(action.sendText, {
        displayText: action.displayText ?? action.label,
        clearInteraction: true,
      });
    },
    [focusCommandInput, sendCommand],
  );

  const handleVoiceRelease = useCallback(async () => {
    setIsPressing(false);
    const simulatedVoiceCommand = "检查当前工作目录下的项目结构";
    await sendCommand(simulatedVoiceCommand);
  }, [sendCommand]);

  const handleCreateSession = useCallback(async () => {
    if (!newSessionWorkerId || !newSessionPath) {
      setManagementError("请选择 worker 和 path 后再创建 session。");
      return;
    }

    const nextTraceId = createTraceId();
    const displayName =
      newSessionDisplayName.trim() || `${getPathLabel(newSessionPath)} session`;

    try {
      setIsCreatingSession(true);
      setManagementError(null);

      const session = await managementClient.createSession({
        workerId: newSessionWorkerId,
        workingDirectory: newSessionPath,
        displayName,
        traceId: nextTraceId,
      });

      await loadManagementData();
      void loadAuditEntries();
      setNewSessionDisplayName("");
      await openSession(session);
    } catch (error) {
      const message = (error as Error).message;

      if (isAuthFailure(message)) {
        clearAuthentication();
        setAuthError(
          "登录已过期，请重新登录。\nYour session expired. Please sign in again.",
        );
      } else {
        setManagementError(message);
      }
    } finally {
      setIsCreatingSession(false);
    }
  }, [
    clearAuthentication,
    loadManagementData,
    managementClient,
    newSessionDisplayName,
    newSessionPath,
    newSessionWorkerId,
    openSession,
  ]);

  const handleDeleteSession = useCallback(
    async (session: GatewaySession) => {
      try {
        setIsDeletingSessionId(session.sessionId);
        setManagementError(null);

        if (session.sessionId === activeSessionRef.current?.sessionId) {
          await disconnectCurrentServer();
          setActiveView("home");
        }

        await managementClient.closeSession(session.sessionId);
        await loadManagementData();
        void loadAuditEntries();
      } catch (error) {
        const message = (error as Error).message;

        if (isAuthFailure(message)) {
          clearAuthentication();
          setAuthError(
            "登录已过期，请重新登录。\nYour session expired. Please sign in again.",
          );
        } else {
          setManagementError(message);
        }
      } finally {
        setIsDeletingSessionId(null);
      }
    },
    [
      clearAuthentication,
      disconnectCurrentServer,
      loadAuditEntries,
      loadManagementData,
      managementClient,
    ],
  );

  const handleDeleteWorker = useCallback(
    async (worker: GatewayWorker) => {
      try {
        setIsDeletingWorkerId(worker.workerId);
        setManagementError(null);
        await managementClient.deleteWorker(worker.workerId);
        await loadManagementData();
        void loadAuditEntries();
      } catch (error) {
        const message = (error as Error).message;

        if (isAuthFailure(message)) {
          clearAuthentication();
          setAuthError(
            "登录已过期，请重新登录。\nYour session expired. Please sign in again.",
          );
        } else {
          setManagementError(message);
        }
      } finally {
        setIsDeletingWorkerId(null);
      }
    },
    [
      clearAuthentication,
      loadAuditEntries,
      loadManagementData,
      managementClient,
    ],
  );

  const handleLeaveTerminal = useCallback(async () => {
    await disconnectCurrentServer();
    setActiveView("home");
  }, [disconnectCurrentServer]);

  const handleSelectView = useCallback(
    async (view: View) => {
      setActiveView(view);

      if (view === "terminal") {
        const currentSession = activeSessionRef.current;
        const currentWorker =
          workers.find(
            (worker) => worker.workerId === currentSession?.workerId,
          ) ?? null;

        if (currentSession) {
          setTerminalLogs(buildSessionBootLogs(currentSession, currentWorker));
          await ensureTerminalConnection();
        } else {
          setManagementError(
            "当前没有可打开的会话，请先创建或选择一个 session。",
          );
          setActiveView("home", { replace: true });
        }
      }
    },
    [ensureTerminalConnection, setActiveView, workers],
  );

  const handleSubmitInput = useCallback(async () => {
    const command = inputValue;
    setInputValue("");
    await sendCommand(command);
  }, [inputValue, sendCommand]);

  return {
    gatewayUrl,
    activeView,
    currentPrincipal,
    isAuthBootstrapping,
    isAppLoggedIn,
    authMode,
    authUsername,
    authPassword,
    authDisplayName,
    authEmail,
    authError,
    isAuthenticating,
    workerPairingCode,
    workerPairingError,
    workerPairingMessage,
    isApprovingWorkerPairing,
    currentPath,
    inputValue,
    inputMode,
    isPressing,
    traceId,
    connectionState,
    workers,
    sessions,
    auditEntries,
    activeSession,
    activeWorker,
    activeSessionId,
    isLoadingManagement,
    managementError,
    isLoadingAudit,
    auditError,
    newSessionAgentFamily,
    availableAgentFamilies,
    newSessionWorkerId,
    newSessionPath,
    newSessionDisplayName,
    isCreatingSession,
    isDeletingSessionId,
    isDeletingWorkerId,
    terminalInteraction,
    showInteractionComposer,
    shouldHideDefaultComposer,
    terminalHostRef,
    commandInputRef,
    setActiveView,
    setAuthMode,
    setAuthUsername,
    setAuthPassword,
    setAuthDisplayName,
    setAuthEmail,
    setWorkerPairingCode,
    setInputValue,
    setInputMode,
    setIsPressing,
    setNewSessionAgentFamily,
    setNewSessionWorkerId,
    setNewSessionPath,
    setNewSessionDisplayName,
    setIsInteractionCustomInputVisible,
    handleAuthenticate,
    handleSignOut,
    handleApproveWorkerPairing,
    loadManagementData,
    loadAuditEntries,
    openSession,
    handleCreateSession,
    handleDeleteSession,
    handleDeleteWorker,
    handleSelectView,
    handleLeaveTerminal,
    handleTerminalInteractionAction,
    handleVoiceRelease,
    handleSubmitInput,
    focusCommandInput,
    connectCurrentSession,
    disconnectCurrentServer,
  };
}
