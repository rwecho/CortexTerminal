import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { createRelayClient, type RelayClient } from "../../../lib/relayClient";
import { gatewayUrl } from "../../app/config";
import { buildAppPath } from "../../app/routeUtils";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import {
  selectIsAppLoggedIn,
  useAuthStore,
} from "../../auth/store/useAuthStore";
import { useSessionsStore } from "../../sessions/store/useSessionsStore";
import { useTerminalStore } from "../store/useTerminalStore";
import {
  appendTerminalTranscript,
  detectTerminalInteraction,
  type TerminalInteractionAction,
} from "../interactionDetector";
import { buildSessionBootLogs, createRequestId } from "../../app/appUtils";
import { buildSessionAccessError } from "../terminalUtils";
import {
  deriveTerminalRecoverySnapshot,
  type TerminalRecoverySnapshot,
} from "../terminalRecovery";
import {
  getNativeBridgeSource,
  pickNativeFiles,
  showNativeAlert,
  showNativeToast,
  startNativeRecording,
  stopNativeRecording,
  type NativePickedFile,
  type NativeRecordedAudio,
} from "../../native/bridge/nativeBridge";
import type { PendingAttachment } from "../terminalAttachmentTypes";
import {
  buildAttachmentCommandPayload,
  buildDoctorCommandPayload,
} from "../relayControlFrames";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function useTerminalRuntime() {
  const { sessionId: routedSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthBootstrapping = useAuthStore(
    (state) => state.isAuthBootstrapping,
  );
  const isAppLoggedIn = useAuthStore(selectIsAppLoggedIn);
  const handleAuthFailure = useAuthFailureHandler();
  const workers = useSessionsStore((state) => state.workers);
  const sessions = useSessionsStore((state) => state.sessions);
  const hasLoadedManagementSnapshot = useSessionsStore(
    (state) => state.hasLoadedManagementSnapshot,
  );
  const isLoadingManagement = useSessionsStore(
    (state) => state.isLoadingManagement,
  );
  const setManagementError = useSessionsStore(
    (state) => state.setManagementError,
  );
  const managementError = useSessionsStore((state) => state.managementError);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const currentPath = useTerminalStore((state) => state.currentPath);
  const inputValue = useTerminalStore((state) => state.inputValue);
  const inputMode = useTerminalStore((state) => state.inputMode);
  const isPressing = useTerminalStore((state) => state.isPressing);
  const traceId = useTerminalStore((state) => state.traceId);
  const connectionState = useTerminalStore((state) => state.connectionState);
  const terminalLogs = useTerminalStore((state) => state.terminalLogs);
  const terminalInteraction = useTerminalStore(
    (state) => state.terminalInteraction,
  );
  const pendingAttachments = useTerminalStore(
    (state) => state.pendingAttachments,
  );
  const isInteractionCustomInputVisible = useTerminalStore(
    (state) => state.isInteractionCustomInputVisible,
  );
  const setActiveSessionId = useTerminalStore(
    (state) => state.setActiveSessionId,
  );
  const setCurrentPath = useTerminalStore((state) => state.setCurrentPath);
  const setInputValue = useTerminalStore((state) => state.setInputValue);
  const setInputMode = useTerminalStore((state) => state.setInputMode);
  const setIsPressing = useTerminalStore((state) => state.setIsPressing);
  const setConnectionState = useTerminalStore(
    (state) => state.setConnectionState,
  );
  const setTerminalLogs = useTerminalStore((state) => state.setTerminalLogs);
  const appendTerminalLogs = useTerminalStore(
    (state) => state.appendTerminalLogs,
  );
  const addPendingAttachments = useTerminalStore(
    (state) => state.addPendingAttachments,
  );
  const removePendingAttachment = useTerminalStore(
    (state) => state.removePendingAttachment,
  );
  const clearPendingAttachments = useTerminalStore(
    (state) => state.clearPendingAttachments,
  );
  const setTerminalInteraction = useTerminalStore(
    (state) => state.setTerminalInteraction,
  );
  const setIsInteractionCustomInputVisible = useTerminalStore(
    (state) => state.setIsInteractionCustomInputVisible,
  );
  const resetTerminalInteraction = useTerminalStore(
    (state) => state.resetTerminalInteraction,
  );
  const regenerateTraceId = useTerminalStore(
    (state) => state.regenerateTraceId,
  );

  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const flushedLogIndexRef = useRef(0);
  const activeSessionRef = useRef(
    sessions.find((session) => session.sessionId === activeSessionId) ?? null,
  );
  const traceIdRef = useRef(traceId);
  const terminalTranscriptRef = useRef("");
  const bootstrappedSessionIdRef = useRef<string | null>(null);
  const relayClientRef = useRef<RelayClient | null>(null);

  const createPendingFileAttachment = useCallback(
    (pickedFile: NativePickedFile): PendingAttachment => ({
      id: createRequestId(),
      kind: "file",
      displayName: pickedFile.fileName,
      fileName: pickedFile.fileName,
      mimeType: pickedFile.contentType,
      size: pickedFile.size,
      base64: pickedFile.base64,
      source: getNativeBridgeSource(),
    }),
    [],
  );

  const createPendingAudioAttachment = useCallback(
    (audio: NativeRecordedAudio): PendingAttachment => ({
      id: createRequestId(),
      kind: "audio",
      displayName: `语音 · ${audio.fileName}`,
      fileName: audio.fileName,
      mimeType: audio.contentType,
      size: audio.size,
      base64: audio.base64,
      durationMs: audio.durationMs,
      source: getNativeBridgeSource(),
    }),
    [],
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

  const showInteractionComposer =
    Boolean(terminalInteraction) && isInteractionCustomInputVisible;
  const shouldHideDefaultComposer =
    Boolean(terminalInteraction) && !showInteractionComposer;
  const recoverySnapshot: TerminalRecoverySnapshot | null = useMemo(
    () =>
      deriveTerminalRecoverySnapshot({
        activeSession,
        activeWorker,
        connectionState,
        errorMessage: managementError,
      }),
    [activeSession, activeWorker, connectionState, managementError],
  );

  const updateTerminalInteraction = useCallback(
    (nextText: string) => {
      terminalTranscriptRef.current = appendTerminalTranscript(
        terminalTranscriptRef.current,
        nextText,
      );

      const nextInteraction = detectTerminalInteraction(
        terminalTranscriptRef.current,
      );

      const currentInteraction =
        useTerminalStore.getState().terminalInteraction;

      if (
        currentInteraction?.signature === nextInteraction?.signature &&
        currentInteraction?.prompt === nextInteraction?.prompt
      ) {
        return;
      }

      if (
        !nextInteraction ||
        currentInteraction?.signature !== nextInteraction.signature
      ) {
        setIsInteractionCustomInputVisible(false);
      }

      setTerminalInteraction(nextInteraction);
    },
    [setIsInteractionCustomInputVisible, setTerminalInteraction],
  );

  const reattachCurrentSession = useCallback(async () => {
    const currentSession = activeSessionRef.current;
    const client = relayClientRef.current;

    if (!currentSession?.workerId || !client) {
      return;
    }

    try {
      setConnectionState("connecting");
      setManagementError(null);
      appendTerminalLogs([
        {
          type: "system",
          text: `Relay 已恢复，正在重新附着 session=${currentSession.sessionId} 到 worker=${currentSession.workerId}...`,
        },
      ]);

      await client.connect(currentSession.sessionId, currentSession.workerId);
      setCurrentPath(currentSession.workingDirectory ?? "/claude");
      await client.sendMobileFrame(
        currentSession.sessionId,
        encoder.encode("__ct_init__"),
        {
          requestId: `sys-reattach-${Date.now()}`,
          traceId: traceIdRef.current,
        },
      );
    } catch (error) {
      const message = (error as Error).message;

      if (handleAuthFailure(message)) {
        await client.disconnect().catch(() => undefined);
        return;
      }

      setConnectionState("error");
      setManagementError(`重新附着 session 失败：${message}`);
      appendTerminalLogs([
        {
          type: "system",
          text: `Relay reattach failed: ${message}`,
        },
      ]);
    }
  }, [
    appendTerminalLogs,
    handleAuthFailure,
    setConnectionState,
    setCurrentPath,
    setManagementError,
  ]);

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
            appendTerminalLogs([
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
              appendTerminalLogs([{ type: "ai", text: remainingText }]);
            }

            return;
          }

          if (text.startsWith("__ct_error__:")) {
            const errorText = text.slice("__ct_error__:".length).trim();
            setConnectionState("error");
            appendTerminalLogs([
              { type: "system", text: `Worker error: ${errorText}` },
            ]);
            return;
          }

          if (!text) {
            return;
          }

          updateTerminalInteraction(text);

          if (xtermRef.current) {
            xtermRef.current.write(text);
            return;
          }

          const requestText = metadata.requestId
            ? ` req=${metadata.requestId}`
            : "";
          const traceText = metadata.traceId
            ? ` trace=${metadata.traceId}`
            : "";
          appendTerminalLogs([
            { type: "ai", text: `${requestText}${traceText}${text}` },
          ]);
        },
        () => accessToken,
        {
          onReconnecting: (error) => {
            setConnectionState("reconnecting");
            appendTerminalLogs([
              {
                type: "system",
                text: `Relay 连接中断，正在自动重连...${error?.message ? ` ${error.message}` : ""}`,
              },
            ]);
          },
          onReconnected: async () => {
            await reattachCurrentSession();
          },
          onClose: (error) => {
            if (!activeSessionRef.current) {
              return;
            }

            setConnectionState("idle");
            appendTerminalLogs([
              {
                type: "system",
                text: `Relay 已断开${error?.message ? `：${error.message}` : ""}`,
              },
            ]);
          },
        },
      ),
    [
      accessToken,
      appendTerminalLogs,
      reattachCurrentSession,
      setConnectionState,
      setCurrentPath,
      updateTerminalInteraction,
    ],
  );

  useEffect(() => {
    relayClientRef.current = relayClient;

    return () => {
      if (relayClientRef.current === relayClient) {
        relayClientRef.current = null;
      }
    };
  }, [relayClient]);

  const focusCommandInput = useCallback(() => {
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!routedSessionId) {
      return;
    }

    if (activeSessionId !== routedSessionId) {
      setActiveSessionId(routedSessionId);
    }
  }, [activeSessionId, routedSessionId, setActiveSessionId]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    traceIdRef.current = traceId;
  }, [traceId]);

  useEffect(() => {
    if (!activeSession) {
      setCurrentPath("/claude");
      resetTerminalInteraction();
      bootstrappedSessionIdRef.current = null;
      return;
    }

    if (bootstrappedSessionIdRef.current === activeSession.sessionId) {
      return;
    }

    setCurrentPath(activeSession.workingDirectory ?? "/claude");
    setTerminalLogs(buildSessionBootLogs(activeSession, activeWorker));
    regenerateTraceId();
    resetTerminalInteraction();
    bootstrappedSessionIdRef.current = activeSession.sessionId;
  }, [
    activeSession,
    activeWorker,
    regenerateTraceId,
    resetTerminalInteraction,
    setCurrentPath,
    setTerminalLogs,
  ]);

  useLayoutEffect(() => {
    if (!activeSession) {
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
  }, [activeSession, terminalLogs]);

  useEffect(() => {
    if (!xtermRef.current) {
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
  }, [terminalLogs]);

  const disconnectCurrentServer = useCallback(async () => {
    await relayClient.disconnect();
    setConnectionState("idle");
    resetTerminalInteraction();
    appendTerminalLogs([
      { type: "system", text: "Disconnected from gateway relay." },
    ]);
  }, [
    appendTerminalLogs,
    relayClient,
    resetTerminalInteraction,
    setConnectionState,
  ]);

  useEffect(
    () => () => {
      void relayClient.disconnect().catch(() => undefined);
      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    },
    [relayClient],
  );

  const connectCurrentSession = useCallback(async () => {
    if (!activeSession?.workerId) {
      const message =
        "当前会话还没有绑定 worker，无法建立 terminal relay。\nThis session is not bound to a worker yet.";
      setConnectionState("error");
      setManagementError(message);
      appendTerminalLogs([{ type: "system", text: message }]);
      return false;
    }

    const boundWorker =
      workers.find((worker) => worker.workerId === activeSession.workerId) ??
      null;

    if (!boundWorker?.isOnline) {
      const message = buildSessionAccessError(activeSession, boundWorker);
      setConnectionState("error");
      setManagementError(message);
      appendTerminalLogs([{ type: "system", text: message }]);
      return false;
    }

    try {
      setConnectionState("connecting");
      setManagementError(null);

      if (relayClient.isConnected()) {
        await relayClient.disconnect();
      }

      await relayClient.connect(
        activeSession.sessionId,
        activeSession.workerId,
      );
      setCurrentPath(activeSession.workingDirectory ?? "/claude");
      appendTerminalLogs([
        {
          type: "system",
          text: `Relay connected: gateway=${gatewayUrl}, session=${activeSession.sessionId}, worker=${activeSession.workerId}, trace=${traceIdRef.current}`,
        },
      ]);

      await relayClient.sendMobileFrame(
        activeSession.sessionId,
        encoder.encode("__ct_init__"),
        {
          requestId: `sys-init-${Date.now()}`,
          traceId: traceIdRef.current,
        },
      );

      return true;
    } catch (error) {
      const message = (error as Error).message;

      const isTransientStartupInterruption =
        message.includes("stopped during negotiation") ||
        message.includes("not in the 'Connected' State");

      if (isTransientStartupInterruption) {
        setConnectionState("idle");
        appendTerminalLogs([
          {
            type: "system",
            text: `Relay 握手被中断，正在自动重试：${message}`,
          },
        ]);
        return false;
      }

      if (handleAuthFailure(message)) {
        await relayClient.disconnect().catch(() => undefined);
        return false;
      }

      const displayMessage = message.includes("offline")
        ? `节点 ${boundWorker.displayName} 当前离线，无法连接该会话。`
        : message.includes("not allowed")
          ? `该会话配置的工作目录不被当前 worker 允许，请重新选择目录或更换节点。\n${message}`
          : `打开会话失败：${message}`;

      setConnectionState("error");
      setManagementError(displayMessage);
      appendTerminalLogs([{ type: "system", text: displayMessage }]);
      return false;
    }
  }, [
    activeSession,
    appendTerminalLogs,
    handleAuthFailure,
    relayClient,
    setConnectionState,
    setCurrentPath,
    setManagementError,
    workers,
  ]);

  useEffect(() => {
    if (!routedSessionId) {
      navigate(buildAppPath("home"), { replace: true });
      return;
    }

    if (isAuthBootstrapping || !isAppLoggedIn) {
      return;
    }

    if (isLoadingManagement || !hasLoadedManagementSnapshot) {
      return;
    }

    const routedSession = sessions.find(
      (session) => session.sessionId === routedSessionId,
    );

    if (!routedSession) {
      setManagementError(
        "目标会话不存在、已被删除，或当前用户无权访问该会话。",
      );
      navigate(buildAppPath("home"), { replace: true });
      return;
    }

    if (connectionState === "idle" && !relayClient.isConnected()) {
      void connectCurrentSession();
    }
  }, [
    connectCurrentSession,
    connectionState,
    hasLoadedManagementSnapshot,
    isAppLoggedIn,
    isAuthBootstrapping,
    isLoadingManagement,
    navigate,
    relayClient,
    routedSessionId,
    sessions,
    setManagementError,
  ]);

  const ensureTerminalConnection = useCallback(async () => {
    if (!activeSession) {
      appendTerminalLogs([
        { type: "system", text: "请先创建或选择一个 session。" },
      ]);
      return false;
    }

    if (connectionState === "connected" && relayClient.isConnected()) {
      return true;
    }

    if (
      connectionState === "connecting" ||
      connectionState === "reconnecting"
    ) {
      return false;
    }

    return connectCurrentSession();
  }, [
    activeSession,
    appendTerminalLogs,
    connectCurrentSession,
    connectionState,
    relayClient,
  ]);

  const sendCommand = useCallback(
    async (command: string, displayText?: string) => {
      const isEscapeCommand = command === "\u001b";
      const isEnterCommand = command === "\n";

      if (!command.trim() && !isEscapeCommand && !isEnterCommand) {
        return;
      }

      resetTerminalInteraction();

      const connected = await ensureTerminalConnection();
      if (!connected || !activeSession) {
        appendTerminalLogs([
          { type: "system", text: "Relay 正在连接中，请稍候再发送。" },
        ]);
        return;
      }

      const requestId = createRequestId();
      const commandDisplay =
        displayText ??
        (isEscapeCommand ? "<Esc>" : isEnterCommand ? "<Enter>" : command);

      appendTerminalLogs([{ type: "command", text: commandDisplay }]);

      try {
        await relayClient.sendMobileFrame(
          activeSession.sessionId,
          encoder.encode(command),
          {
            requestId,
            traceId: traceIdRef.current,
          },
        );
      } catch (error) {
        appendTerminalLogs([
          { type: "system", text: `Send failed: ${(error as Error).message}` },
        ]);
      }
    },
    [
      activeSession,
      appendTerminalLogs,
      ensureTerminalConnection,
      relayClient,
      resetTerminalInteraction,
    ],
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

      await sendCommand(action.sendText, action.displayText ?? action.label);
    },
    [focusCommandInput, sendCommand, setIsInteractionCustomInputVisible],
  );

  const handleAddAttachment = useCallback(async () => {
    try {
      const pickedFiles = await pickNativeFiles();

      if (pickedFiles.length === 0) {
        return;
      }

      const nextAttachments = pickedFiles.map(createPendingFileAttachment);
      addPendingAttachments(nextAttachments);
      appendTerminalLogs([
        {
          type: "system",
          text: `已通过 ${getNativeBridgeSource()} bridge 选择 ${nextAttachments.length} 个附件。`,
        },
      ]);
      await showNativeToast(`已添加 ${nextAttachments.length} 个附件`);
    } catch (error) {
      await showNativeAlert({
        title: "附件选择失败",
        message: (error as Error).message,
      });
    }
  }, [addPendingAttachments, appendTerminalLogs, createPendingFileAttachment]);

  const handleRemoveAttachment = useCallback(
    async (attachmentId: string) => {
      const attachment = pendingAttachments.find(
        (item) => item.id === attachmentId,
      );

      if (!attachment) {
        return;
      }

      const confirmed = await showNativeAlert({
        title: "移除附件",
        message: `要移除 ${attachment.displayName} 吗？`,
        accept: "移除",
        cancel: "保留",
      });

      if (!confirmed) {
        return;
      }

      removePendingAttachment(attachmentId);
      await showNativeToast(`已移除 ${attachment.displayName}`);
    },
    [pendingAttachments, removePendingAttachment],
  );

  const handleVoicePressStart = useCallback(async () => {
    try {
      await startNativeRecording();
      setIsPressing(true);
      await showNativeToast("开始录音");
    } catch (error) {
      setIsPressing(false);
      await showNativeAlert({
        title: "无法开始录音",
        message: (error as Error).message,
      });
    }
  }, [setIsPressing]);

  const handleVoiceRelease = useCallback(async () => {
    if (!isPressing) {
      return;
    }

    setIsPressing(false);

    try {
      const audio = await stopNativeRecording();

      if (!audio) {
        await showNativeToast("录音已取消");
        return;
      }

      const attachment = createPendingAudioAttachment(audio);
      addPendingAttachments([attachment]);
      setInputMode("text");
      appendTerminalLogs([
        {
          type: "system",
          text: `语音附件已加入待发送列表：${attachment.fileName}`,
        },
      ]);
      await showNativeToast("录音已保存为附件");
    } catch (error) {
      await showNativeAlert({
        title: "录音失败",
        message: (error as Error).message,
      });
    }
  }, [
    addPendingAttachments,
    appendTerminalLogs,
    createPendingAudioAttachment,
    isPressing,
    setInputMode,
    setIsPressing,
  ]);

  const sendAttachmentCommand = useCallback(
    async (command: string, attachments: PendingAttachment[]) => {
      resetTerminalInteraction();

      const connected = await ensureTerminalConnection();
      if (!connected || !activeSession) {
        appendTerminalLogs([
          { type: "system", text: "Relay 正在连接中，请稍候再发送。" },
        ]);
        return false;
      }

      const requestId = createRequestId();
      appendTerminalLogs([
        { type: "command", text: command },
        {
          type: "system",
          text: `正在上传 ${attachments.length} 个附件到 worker：${attachments
            .map((attachment) => attachment.fileName)
            .join(", ")}`,
        },
      ]);

      try {
        await relayClient.sendMobileFrame(
          activeSession.sessionId,
          buildAttachmentCommandPayload(command, attachments),
          {
            requestId,
            traceId: traceIdRef.current,
          },
        );
        return true;
      } catch (error) {
        appendTerminalLogs([
          {
            type: "system",
            text: `Attachment send failed: ${(error as Error).message}`,
          },
        ]);
        return false;
      }
    },
    [
      activeSession,
      appendTerminalLogs,
      ensureTerminalConnection,
      relayClient,
      resetTerminalInteraction,
    ],
  );

  const handleSubmitInput = useCallback(async () => {
    const command = inputValue.trim();
    setInputValue("");

    if (pendingAttachments.length > 0) {
      const effectiveCommand =
        command || "请分析刚上传的附件，并总结关键信息。";
      const sent = await sendAttachmentCommand(
        effectiveCommand,
        pendingAttachments,
      );

      if (sent) {
        clearPendingAttachments();
        await showNativeToast(
          `已发送 ${pendingAttachments.length} 个附件到 worker`,
        );
      }

      return;
    }

    await sendCommand(command);
  }, [
    clearPendingAttachments,
    inputValue,
    pendingAttachments,
    sendAttachmentCommand,
    sendCommand,
    setInputValue,
  ]);

  const handleRunDoctor = useCallback(async () => {
    resetTerminalInteraction();

    const connected = await ensureTerminalConnection();
    if (!connected || !activeSession) {
      appendTerminalLogs([
        { type: "system", text: "Relay 正在连接中，请稍候再执行 doctor。" },
      ]);
      return;
    }

    const requestId = createRequestId();
    appendTerminalLogs([
      { type: "command", text: "doctor" },
      {
        type: "system",
        text: `正在请求 worker ${activeSession.workerId} 执行环境自检...`,
      },
    ]);

    try {
      await relayClient.sendMobileFrame(
        activeSession.sessionId,
        buildDoctorCommandPayload(),
        {
          requestId,
          traceId: traceIdRef.current,
        },
      );
      await showNativeToast("已触发 worker doctor");
    } catch (error) {
      appendTerminalLogs([
        {
          type: "system",
          text: `Doctor send failed: ${(error as Error).message}`,
        },
      ]);
      await showNativeAlert({
        title: "Doctor 执行失败",
        message: (error as Error).message,
      });
    }
  }, [
    activeSession,
    appendTerminalLogs,
    ensureTerminalConnection,
    relayClient,
    resetTerminalInteraction,
  ]);

  const handleLeaveTerminal = useCallback(() => {
    navigate(buildAppPath("home"));
  }, [navigate]);

  return {
    activeSession,
    activeWorker,
    currentPath,
    connectionState,
    recoverySnapshot,
    errorMessage: managementError,
    terminalInteraction,
    showInteractionComposer,
    shouldHideDefaultComposer,
    inputMode,
    inputValue,
    isPressing,
    pendingAttachments,
    traceId,
    terminalHostRef,
    commandInputRef,
    setInputMode,
    setInputValue,
    setIsPressing,
    setIsInteractionCustomInputVisible,
    handleLeaveTerminal,
    handleAddAttachment,
    handleRemoveAttachment,
    handleTerminalInteractionAction,
    handleVoicePressStart,
    handleVoiceRelease,
    handleRunDoctor,
    handleSubmitInput,
    connectCurrentSession,
    disconnectCurrentServer,
  };
}
