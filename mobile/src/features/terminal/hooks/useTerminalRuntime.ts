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
import { getValidAccessToken } from "../../auth/authSessionService";
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
import {
  buildSessionBootLogs,
  createRequestId,
  getAgentLabel,
  inferAgentFamily,
  toUserFacingManagementError,
} from "../../app/appUtils";
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
  buildTerminalResizePayload,
} from "../relayControlFrames";
import { buildRuntimeShortcuts } from "../terminalShortcuts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const sessionReadyTimeoutMs = 30_000;

type OutboundFrame = {
  sessionId: string;
  payload: Uint8Array;
  metadata: {
    requestId?: string;
    traceId?: string;
  };
};

type SessionReadyWaiter = {
  promise: Promise<boolean>;
  resolve: (ready: boolean) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type TerminalSize = {
  cols: number;
  rows: number;
};

const minTerminalColumns = 40;
const minTerminalRows = 12;

function normalizeTerminalSize(cols: number, rows: number): TerminalSize {
  return {
    cols: Math.max(minTerminalColumns, Math.floor(cols)),
    rows: Math.max(minTerminalRows, Math.floor(rows)),
  };
}

function resolveActiveSession(
  sessions: GatewaySession[],
  activeSessionId: string | null,
  routedSessionId: string | undefined,
) {
  if (activeSessionId) {
    const activeSession = sessions.find(
      (session) => session.sessionId === activeSessionId,
    );
    if (activeSession) {
      return activeSession;
    }
  }

  if (!routedSessionId) {
    return null;
  }

  return (
    sessions.find((session) => session.sessionId === routedSessionId) ?? null
  );
}

export function useTerminalRuntime() {
  const { sessionId: routedSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
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
    resolveActiveSession(sessions, activeSessionId, routedSessionId),
  );
  const traceIdRef = useRef(traceId);
  const terminalTranscriptRef = useRef("");
  const bootstrappedSessionIdRef = useRef<string | null>(null);
  const relayClientRef = useRef<RelayClient | null>(null);
  const readySessionIdRef = useRef<string | null>(null);
  const sessionReadyWaitersRef = useRef<Map<string, SessionReadyWaiter>>(
    new Map(),
  );
  const outboundQueueRef = useRef<Map<string, OutboundFrame[]>>(new Map());
  const terminalSizeRef = useRef<TerminalSize | null>(null);
  const lastSentTerminalSizeRef = useRef<Map<string, string>>(new Map());

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
    () => resolveActiveSession(sessions, activeSessionId, routedSessionId),
    [activeSessionId, routedSessionId, sessions],
  );
  const activeWorker = useMemo(
    () =>
      workers.find((worker) => worker.workerId === activeSession?.workerId) ??
      null,
    [activeSession?.workerId, workers],
  );
  const activeAgentFamily = useMemo(() => {
    const sessionAgentFamily = activeSession?.agentFamily?.trim().toLowerCase();

    return sessionAgentFamily === "claude" ||
      sessionAgentFamily === "codex" ||
      sessionAgentFamily === "gemini" ||
      sessionAgentFamily === "opencode" ||
      sessionAgentFamily === "copilot"
      ? sessionAgentFamily
      : inferAgentFamily(activeWorker?.modelName);
  }, [activeSession?.agentFamily, activeWorker?.modelName]);
  const runtimeShortcutLabel = useMemo(
    () => `${getAgentLabel(activeAgentFamily)} 快捷键`,
    [activeAgentFamily],
  );
  const runtimeShortcuts = useMemo(
    () => buildRuntimeShortcuts(activeAgentFamily),
    [activeAgentFamily],
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

  const resetSessionReadyState = useCallback((sessionId?: string | null) => {
    if (!sessionId) {
      readySessionIdRef.current = null;
      return;
    }

    if (readySessionIdRef.current === sessionId) {
      readySessionIdRef.current = null;
    }
  }, []);

  const waitForSessionReady = useCallback(
    (sessionId: string, timeoutMs = sessionReadyTimeoutMs) => {
      if (readySessionIdRef.current === sessionId) {
        return Promise.resolve(true);
      }

      const existingWaiter = sessionReadyWaitersRef.current.get(sessionId);
      if (existingWaiter) {
        return existingWaiter.promise;
      }

      let resolveWaiter: ((ready: boolean) => void) | null = null;
      const promise = new Promise<boolean>((resolve) => {
        resolveWaiter = resolve;
      });

      const timeoutId = setTimeout(() => {
        const waiter = sessionReadyWaitersRef.current.get(sessionId);
        if (!waiter || waiter.promise !== promise) {
          return;
        }

        sessionReadyWaitersRef.current.delete(sessionId);
        resolveWaiter?.(false);
      }, timeoutMs);

      sessionReadyWaitersRef.current.set(sessionId, {
        promise,
        resolve: (ready) => {
          clearTimeout(timeoutId);
          sessionReadyWaitersRef.current.delete(sessionId);
          resolveWaiter?.(ready);
        },
        timeoutId,
      });

      return promise;
    },
    [],
  );

  const markSessionReady = useCallback((sessionId: string) => {
    readySessionIdRef.current = sessionId;
    sessionReadyWaitersRef.current.get(sessionId)?.resolve(true);
  }, []);

  const failSessionReady = useCallback((sessionId?: string | null) => {
    if (!sessionId) {
      return;
    }

    if (readySessionIdRef.current === sessionId) {
      readySessionIdRef.current = null;
    }

    sessionReadyWaitersRef.current.get(sessionId)?.resolve(false);
  }, []);

  const setMeasuredTerminalSize = useCallback((cols: number, rows: number) => {
    const nextSize = normalizeTerminalSize(cols, rows);
    const previousSize = terminalSizeRef.current;

    if (
      previousSize?.cols === nextSize.cols &&
      previousSize.rows === nextSize.rows
    ) {
      return false;
    }

    terminalSizeRef.current = nextSize;
    return true;
  }, []);

  const sendTerminalResize = useCallback(async (force = false) => {
    const currentSession = activeSessionRef.current;
    const client = relayClientRef.current;
    const size = terminalSizeRef.current;

    if (!currentSession || !client?.isConnected() || !size) {
      return false;
    }

    const sizeKey = `${size.cols}x${size.rows}`;
    if (
      !force &&
      lastSentTerminalSizeRef.current.get(currentSession.sessionId) === sizeKey
    ) {
      return true;
    }

    await client.sendMobileFrame(
      currentSession.sessionId,
      buildTerminalResizePayload(size.cols, size.rows),
      {
        requestId: `sys-resize-${Date.now()}`,
        traceId: traceIdRef.current,
      },
    );

    lastSentTerminalSizeRef.current.set(currentSession.sessionId, sizeKey);
    return true;
  }, []);

  const enqueueOutboundFrame = useCallback(
    (frame: OutboundFrame, pendingMessage: string) => {
      const queue = outboundQueueRef.current.get(frame.sessionId) ?? [];
      const wasEmpty = queue.length === 0;
      queue.push(frame);
      outboundQueueRef.current.set(frame.sessionId, queue);

      if (wasEmpty) {
        appendTerminalLogs([{ type: "system", text: pendingMessage }]);
      }
    },
    [appendTerminalLogs],
  );

  const flushOutboundQueue = useCallback(
    async (sessionId: string) => {
      if (readySessionIdRef.current !== sessionId) {
        return false;
      }

      const client = relayClientRef.current;
      if (!client?.isConnected()) {
        return false;
      }

      const queue = outboundQueueRef.current.get(sessionId);
      if (!queue || queue.length === 0) {
        return true;
      }

      while (queue.length > 0) {
        const nextFrame = queue[0];
        try {
          await client.sendMobileFrame(
            nextFrame.sessionId,
            nextFrame.payload,
            nextFrame.metadata,
          );
          queue.shift();
        } catch (error) {
          appendTerminalLogs([
            {
              type: "system",
              text: `Queued send failed: ${(error as Error).message}`,
            },
          ]);
          return false;
        }
      }

      outboundQueueRef.current.delete(sessionId);
      return true;
    },
    [appendTerminalLogs],
  );

  const reattachCurrentSession = useCallback(async () => {
    const currentSession = activeSessionRef.current;
    const client = relayClientRef.current;

    if (!currentSession?.workerId || !client) {
      return;
    }

    try {
      resetSessionReadyState(currentSession.sessionId);
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
      const measuredTerminalSize = terminalSizeRef.current;
      if (measuredTerminalSize) {
        await client.sendMobileFrame(
          currentSession.sessionId,
          buildTerminalResizePayload(
            measuredTerminalSize.cols,
            measuredTerminalSize.rows,
          ),
          {
            requestId: `sys-resize-reattach-${Date.now()}`,
            traceId: traceIdRef.current,
          },
        );
        lastSentTerminalSizeRef.current.set(
          currentSession.sessionId,
          `${measuredTerminalSize.cols}x${measuredTerminalSize.rows}`,
        );
      }
      await client.sendMobileFrame(
        currentSession.sessionId,
        encoder.encode("__ct_init__"),
        {
          requestId: `sys-reattach-${Date.now()}`,
          traceId: traceIdRef.current,
        },
      );
      await waitForSessionReady(currentSession.sessionId);
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
    resetSessionReadyState,
    setConnectionState,
    setCurrentPath,
    setManagementError,
    waitForSessionReady,
    sendTerminalResize,
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
            markSessionReady(sessionId);
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
            void flushOutboundQueue(sessionId);
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
        getValidAccessToken,
        {
          onReconnecting: (error) => {
            failSessionReady(activeSessionRef.current?.sessionId);
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

            failSessionReady(activeSessionRef.current.sessionId);
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
      appendTerminalLogs,
      failSessionReady,
      flushOutboundQueue,
      markSessionReady,
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
      resetSessionReadyState(null);
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
    resetSessionReadyState(activeSession.sessionId);
  }, [
    activeSession,
    activeWorker,
    regenerateTraceId,
    resetSessionReadyState,
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
      terminalSizeRef.current = null;
      return;
    }

    let disposed = false;
    let mountFrameId = 0;
    let fitFrameId = 0;
    let resizeObserver: ResizeObserver | null = null;

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

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;
      flushedLogIndexRef.current = 0;

      const syncTerminalViewport = (forceResizeFrame = false) => {
        fitAddon.fit();
        const sizeChanged = setMeasuredTerminalSize(xterm.cols, xterm.rows);
        if (forceResizeFrame || sizeChanged) {
          void sendTerminalResize(forceResizeFrame);
        }
      };

      syncTerminalViewport(true);

      xterm.onResize(({ cols, rows }) => {
        if (setMeasuredTerminalSize(cols, rows)) {
          void sendTerminalResize();
        }
      });

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
      syncTerminalViewport(true);
      fitFrameId = requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        const term = xtermRef.current;
        if (term && setMeasuredTerminalSize(term.cols, term.rows)) {
          void sendTerminalResize();
        }
      });

      resizeObserver = new ResizeObserver(() => {
        syncTerminalViewport();
      });
      resizeObserver.observe(terminalHostElement);
    };

    mountFrameId = requestAnimationFrame(mountTerminal);

    const handleResize = () => {
      fitAddonRef.current?.fit();
      const term = xtermRef.current;
      if (term && setMeasuredTerminalSize(term.cols, term.rows)) {
        void sendTerminalResize();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(mountFrameId);
      cancelAnimationFrame(fitFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);

      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }

      fitAddonRef.current = null;
      flushedLogIndexRef.current = 0;
      terminalSizeRef.current = null;
    };
  }, [activeSession, sendTerminalResize, setMeasuredTerminalSize]);

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
    if (setMeasuredTerminalSize(term.cols, term.rows)) {
      void sendTerminalResize();
    }
  }, [sendTerminalResize, setMeasuredTerminalSize, terminalLogs]);

  const disconnectCurrentServer = useCallback(async () => {
    await relayClient.disconnect();
    failSessionReady(activeSessionRef.current?.sessionId);
    setConnectionState("idle");
    resetTerminalInteraction();
    appendTerminalLogs([
      { type: "system", text: "Disconnected from gateway relay." },
    ]);
  }, [
    appendTerminalLogs,
    failSessionReady,
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

    if (!boundWorker) {
      const message = buildSessionAccessError(activeSession, boundWorker);
      setConnectionState("error");
      setManagementError(message);
      appendTerminalLogs([{ type: "system", text: message }]);
      return false;
    }

    try {
      resetSessionReadyState(activeSession.sessionId);
      setConnectionState("connecting");
      setManagementError(null);

      if (!boundWorker.isOnline) {
        appendTerminalLogs([
          {
            type: "system",
            text: `节点 ${boundWorker.displayName} 的在线快照尚未更新，先尝试直接附着当前会话...`,
          },
        ]);
      }

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

      const measuredTerminalSize = terminalSizeRef.current;
      if (measuredTerminalSize) {
        await relayClient.sendMobileFrame(
          activeSession.sessionId,
          buildTerminalResizePayload(
            measuredTerminalSize.cols,
            measuredTerminalSize.rows,
          ),
          {
            requestId: `sys-resize-init-${Date.now()}`,
            traceId: traceIdRef.current,
          },
        );
        lastSentTerminalSizeRef.current.set(
          activeSession.sessionId,
          `${measuredTerminalSize.cols}x${measuredTerminalSize.rows}`,
        );
      }

      await relayClient.sendMobileFrame(
        activeSession.sessionId,
        encoder.encode("__ct_init__"),
        {
          requestId: `sys-init-${Date.now()}`,
          traceId: traceIdRef.current,
        },
      );

      const ready = await waitForSessionReady(activeSession.sessionId);
      if (!ready) {
        setConnectionState("idle");
        appendTerminalLogs([
          {
            type: "system",
            text: "Session 尚未 ready，已等待 relay 重新附着。",
          },
        ]);
      }

      return ready;
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
          ? "当前目录不允许在这个节点上执行，请重新选择目录或节点。"
          : toUserFacingManagementError(message);

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
    resetSessionReadyState,
    setConnectionState,
    setCurrentPath,
    setManagementError,
    waitForSessionReady,
    workers,
    sendTerminalResize,
  ]);

  useEffect(() => {
    if (!activeSession || connectionState !== "connected") {
      return;
    }

    void sendTerminalResize(true);
  }, [activeSession, connectionState, sendTerminalResize]);

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

    if (!activeSession || activeSession.sessionId !== routedSessionId) {
      return;
    }

    if (connectionState === "idle" && !relayClient.isConnected()) {
      void connectCurrentSession();
    }
  }, [
    activeSession,
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
      return readySessionIdRef.current === activeSession.sessionId;
    }

    if (
      connectionState === "connecting" ||
      connectionState === "reconnecting"
    ) {
      return waitForSessionReady(activeSession.sessionId);
    }

    return connectCurrentSession();
  }, [
    activeSession,
    appendTerminalLogs,
    connectCurrentSession,
    connectionState,
    relayClient,
    waitForSessionReady,
  ]);

  const sendOrQueueFrame = useCallback(
    async (
      frame: OutboundFrame,
      pendingMessage: string,
      failureMessagePrefix: string,
    ) => {
      if (
        readySessionIdRef.current !== frame.sessionId ||
        !relayClient.isConnected()
      ) {
        enqueueOutboundFrame(frame, pendingMessage);
        const activeSessionId = activeSessionRef.current?.sessionId;
        if (
          activeSessionId === frame.sessionId &&
          connectionState !== "connecting" &&
          connectionState !== "reconnecting"
        ) {
          void connectCurrentSession();
        }
        return true;
      }

      try {
        await relayClient.sendMobileFrame(
          frame.sessionId,
          frame.payload,
          frame.metadata,
        );
        return true;
      } catch (error) {
        enqueueOutboundFrame(frame, pendingMessage);
        appendTerminalLogs([
          {
            type: "system",
            text: `${failureMessagePrefix}: ${(error as Error).message}`,
          },
        ]);
        failSessionReady(frame.sessionId);
        setConnectionState("idle");
        return false;
      }
    },
    [
      appendTerminalLogs,
      connectCurrentSession,
      connectionState,
      enqueueOutboundFrame,
      failSessionReady,
      relayClient,
      setConnectionState,
    ],
  );

  const sendCommand = useCallback(
    async (command: string, displayText?: string) => {
      const isEscapeCommand = command === "\u001b";
      const isEnterCommand = command === "\n";
      const isTabCommand = command === "\t";
      const isShiftTabCommand = command === "\u001b[Z";

      if (
        !command.trim() &&
        !isEscapeCommand &&
        !isEnterCommand &&
        !isTabCommand &&
        !isShiftTabCommand
      ) {
        return;
      }

      resetTerminalInteraction();

      if (!activeSession) {
        appendTerminalLogs([{ type: "system", text: "请先创建或选择一个 session。" }]);
        return;
      }

      const requestId = createRequestId();
      const commandDisplay =
        displayText ??
        (isEscapeCommand
          ? "<Esc>"
          : isEnterCommand
            ? "<Enter>"
            : isTabCommand
              ? "<Tab>"
              : isShiftTabCommand
                ? "<Shift+Tab>"
                : command);

      appendTerminalLogs([{ type: "command", text: commandDisplay }]);

      await sendOrQueueFrame(
        {
          sessionId: activeSession.sessionId,
          payload: encoder.encode(command),
          metadata: {
            requestId,
            traceId: traceIdRef.current,
          },
        },
        "Relay 正在连接或恢复中，命令已加入待发送队列。",
        "Send failed",
      );
    },
    [
      activeSession,
      appendTerminalLogs,
      resetTerminalInteraction,
      sendOrQueueFrame,
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

  const handleRuntimeShortcut = useCallback(
    async (shortcut: { sendText: string; displayText: string }) => {
      await sendCommand(shortcut.sendText, shortcut.displayText);
    },
    [sendCommand],
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

      if (!activeSession) {
        appendTerminalLogs([{ type: "system", text: "请先创建或选择一个 session。" }]);
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

      return sendOrQueueFrame(
        {
          sessionId: activeSession.sessionId,
          payload: buildAttachmentCommandPayload(command, attachments),
          metadata: {
            requestId,
            traceId: traceIdRef.current,
          },
        },
        "Relay 正在连接或恢复中，附件命令已加入待发送队列。",
        "Attachment send failed",
      );
    },
    [
      activeSession,
      appendTerminalLogs,
      resetTerminalInteraction,
      sendOrQueueFrame,
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

    if (!activeSession) {
      appendTerminalLogs([{ type: "system", text: "请先创建或选择一个 session。" }]);
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

    const accepted = await sendOrQueueFrame(
      {
        sessionId: activeSession.sessionId,
        payload: buildDoctorCommandPayload(),
        metadata: {
          requestId,
          traceId: traceIdRef.current,
        },
      },
      "Relay 正在连接或恢复中，doctor 请求已加入待发送队列。",
      "Doctor send failed",
    );

    if (accepted) {
      await showNativeToast("已触发或排队 worker doctor");
    } else {
      await showNativeAlert({
        title: "Doctor 执行失败",
        message: "doctor 请求发送失败，请查看终端日志。",
      });
    }
  }, [
    activeSession,
    appendTerminalLogs,
    resetTerminalInteraction,
    sendOrQueueFrame,
    showNativeAlert,
    showNativeToast,
  ]);

  const handleLeaveTerminal = useCallback(() => {
    navigate(buildAppPath("home"));
  }, [navigate]);

  return {
    activeSession,
    activeWorker,
    activeAgentFamily,
    currentPath,
    connectionState,
    recoverySnapshot,
    errorMessage: managementError,
    runtimeShortcutLabel,
    runtimeShortcuts,
    terminalInteraction,
    showInteractionComposer,
    shouldHideDefaultComposer,
    inputMode,
    inputValue,
    isPressing,
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
    handleRuntimeShortcut,
    handleTerminalInteractionAction,
    handleVoicePressStart,
    handleVoiceRelease,
    handleRunDoctor,
    handleSubmitInput,
    connectCurrentSession,
    disconnectCurrentServer,
  };
}
