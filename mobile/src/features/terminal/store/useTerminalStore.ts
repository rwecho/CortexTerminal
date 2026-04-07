import { create } from "zustand";
import type { TerminalInteraction } from "../interactionDetector";
import type { LogItem } from "../../app/appTypes";
import { buildSessionBootLogs, createTraceId } from "../../app/appUtils";

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type InputMode = "text" | "voice";

type TerminalStore = {
  activeSessionId: string | null;
  currentPath: string;
  inputValue: string;
  inputMode: InputMode;
  isPressing: boolean;
  traceId: string;
  connectionState: ConnectionState;
  terminalLogs: LogItem[];
  terminalInteraction: TerminalInteraction | null;
  isInteractionCustomInputVisible: boolean;
  setActiveSessionId: (activeSessionId: string | null) => void;
  setCurrentPath: (currentPath: string) => void;
  setInputValue: (inputValue: string) => void;
  setInputMode: (
    inputMode: InputMode | ((current: InputMode) => InputMode),
  ) => void;
  setIsPressing: (isPressing: boolean) => void;
  setTraceId: (traceId: string) => void;
  regenerateTraceId: () => string;
  setConnectionState: (connectionState: ConnectionState) => void;
  setTerminalLogs: (terminalLogs: LogItem[]) => void;
  appendTerminalLogs: (logs: LogItem[]) => void;
  setTerminalInteraction: (
    terminalInteraction: TerminalInteraction | null,
  ) => void;
  setIsInteractionCustomInputVisible: (
    isInteractionCustomInputVisible: boolean,
  ) => void;
  resetTerminalInteraction: () => void;
  resetTerminalState: () => void;
};

export const useTerminalStore = create<TerminalStore>((set) => ({
  activeSessionId: null,
  currentPath: "/claude",
  inputValue: "",
  inputMode: "text",
  isPressing: false,
  traceId: createTraceId(),
  connectionState: "idle",
  terminalLogs: buildSessionBootLogs(null, null),
  terminalInteraction: null,
  isInteractionCustomInputVisible: false,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setCurrentPath: (currentPath) => set({ currentPath }),
  setInputValue: (inputValue) => set({ inputValue }),
  setInputMode: (inputMode) =>
    set((state) => ({
      inputMode:
        typeof inputMode === "function"
          ? inputMode(state.inputMode)
          : inputMode,
    })),
  setIsPressing: (isPressing) => set({ isPressing }),
  setTraceId: (traceId) => set({ traceId }),
  regenerateTraceId: () => {
    const traceId = createTraceId();
    set({ traceId });
    return traceId;
  },
  setConnectionState: (connectionState) => set({ connectionState }),
  setTerminalLogs: (terminalLogs) => set({ terminalLogs }),
  appendTerminalLogs: (logs) =>
    set((state) => ({ terminalLogs: [...state.terminalLogs, ...logs] })),
  setTerminalInteraction: (terminalInteraction) => set({ terminalInteraction }),
  setIsInteractionCustomInputVisible: (isInteractionCustomInputVisible) =>
    set({ isInteractionCustomInputVisible }),
  resetTerminalInteraction: () =>
    set({
      terminalInteraction: null,
      isInteractionCustomInputVisible: false,
    }),
  resetTerminalState: () =>
    set({
      activeSessionId: null,
      currentPath: "/claude",
      inputValue: "",
      inputMode: "text",
      isPressing: false,
      traceId: createTraceId(),
      connectionState: "idle",
      terminalLogs: buildSessionBootLogs(null, null),
      terminalInteraction: null,
      isInteractionCustomInputVisible: false,
    }),
}));
