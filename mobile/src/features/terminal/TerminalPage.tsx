import {
  ChevronLeft,
  FolderTree,
  Keyboard,
  Mic,
  Plus,
  Send,
  ShieldCheck,
  Terminal as TermIcon,
} from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import type {
  GatewaySession,
  GatewayWorker,
} from "../../lib/gatewayManagementClient";
import { TerminalInteractionBar } from "./TerminalInteractionBar";
import type {
  TerminalInteraction,
  TerminalInteractionAction,
} from "./interactionDetector";

type TerminalPageProps = {
  activeSession: GatewaySession | null;
  activeWorker: GatewayWorker | null;
  currentPath: string;
  connectionState: "idle" | "connecting" | "connected" | "error";
  errorMessage: string | null;
  terminalInteraction: TerminalInteraction | null;
  showInteractionComposer: boolean;
  shouldHideDefaultComposer: boolean;
  inputMode: "text" | "voice";
  inputValue: string;
  isPressing: boolean;
  terminalHostRef: React.RefObject<HTMLDivElement | null>;
  commandInputRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void | Promise<void>;
  onInteractionAction: (
    action: TerminalInteractionAction,
  ) => void | Promise<void>;
  onInputModeToggle: () => void;
  onInputValueChange: (value: string) => void;
  onInputSubmit: () => void | Promise<void>;
  onVoicePressStart: () => void;
  onVoicePressEnd: () => void | Promise<void>;
  onCloseInteractionComposer: () => void;
};

export function TerminalPage({
  activeSession,
  activeWorker,
  currentPath,
  connectionState,
  errorMessage,
  terminalInteraction,
  showInteractionComposer,
  shouldHideDefaultComposer,
  inputMode,
  inputValue,
  isPressing,
  terminalHostRef,
  commandInputRef,
  onBack,
  onInteractionAction,
  onInputModeToggle,
  onInputValueChange,
  onInputSubmit,
  onVoicePressStart,
  onVoicePressEnd,
  onCloseInteractionComposer,
}: TerminalPageProps) {
  if (!activeSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <div className="rounded-full border border-[#1f2a30] bg-[#0b1215] p-4 text-cyan-400">
          <TermIcon size={28} />
        </div>
        <div>
          <div className="text-lg font-semibold text-white">
            No Active Session
          </div>
          <div className="mt-1 text-sm text-gray-500">
            先回到 New Session 或 Home，选一个正式会话再进入 terminal。
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-black animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#111] bg-[#0a0a0a] px-3 py-2">
        <button
          type="button"
          onClick={() => {
            void onBack();
          }}
          className="p-1.5 text-gray-400"
          aria-label="back to home"
          title="back to home"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex flex-1 flex-col items-center px-4">
          <span className="max-w-full truncate text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            {activeSession.displayName ??
              activeWorker?.displayName ??
              activeSession.sessionId}
          </span>
          <div className="mt-1 flex items-center gap-1.5 rounded-full border border-[#222] bg-[#111] px-2 py-0.5">
            <FolderTree size={10} className="text-cyan-600 opacity-70" />
            <span className="max-w-48 truncate font-mono text-[9px] text-cyan-600">
              {currentPath}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1.5">
          <ShieldCheck size={18} className="text-green-500" />
          <span
            data-testid="status"
            className={`text-[10px] ${
              connectionState === "connected"
                ? "text-green-500"
                : connectionState === "error"
                  ? "text-red-500"
                  : "text-gray-500"
            }`}
          >
            {connectionState.toUpperCase()}
          </span>
        </div>
      </div>

      <div
        data-testid="terminal-output"
        className="flex-1 overflow-hidden bg-black p-2"
      >
        {errorMessage && (
          <div className="mb-2 rounded-2xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </div>
        )}
        <div ref={terminalHostRef} className="h-full w-full" />
      </div>

      <div className="border-t border-[#111] bg-[#080808] px-2 pt-2 pb-6">
        {terminalInteraction && (
          <div className="mx-auto max-w-4xl">
            <TerminalInteractionBar
              interaction={terminalInteraction}
              onAction={(action) => {
                void onInteractionAction(action);
              }}
            />
          </div>
        )}

        {shouldHideDefaultComposer ? (
          <div className="mx-auto max-w-4xl rounded-2xl border border-[#1f2a30] bg-[#0a1114] px-4 py-3 text-sm text-gray-400">
            当前是交互判断阶段，普通输入区已隐藏。请直接选择上方操作；如果需要自己输入，请先点击“输入自定义回复”。
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl items-center gap-2">
            {showInteractionComposer ? (
              <button
                type="button"
                onClick={onCloseInteractionComposer}
                className="rounded-xl border border-[#223038] px-3 py-2 text-[11px] text-gray-300"
              >
                返回选项
              </button>
            ) : (
              <button
                type="button"
                onClick={onInputModeToggle}
                className="p-2 text-gray-600"
                aria-label="toggle input mode"
                title="toggle input mode"
              >
                {inputMode === "text" ? (
                  <Mic size={24} />
                ) : (
                  <Keyboard size={24} />
                )}
              </button>
            )}

            <div className="h-10.5 flex-1">
              {showInteractionComposer || inputMode === "text" ? (
                <div className="flex h-full flex-1 items-center rounded-xl border border-[#222] bg-[#151515] px-3 py-1.5">
                  <input
                    ref={commandInputRef}
                    data-testid="command-input"
                    type="text"
                    placeholder={
                      showInteractionComposer
                        ? "输入你想给当前 agent 的自定义回复..."
                        : "让当前 agent 在当前目录里执行任务..."
                    }
                    className="flex-1 border-none bg-transparent font-sans text-[14px] text-gray-200 outline-none"
                    value={inputValue}
                    onChange={(event) => onInputValueChange(event.target.value)}
                    onKeyDown={async (event) => {
                      if (event.key === "Enter") {
                        await onInputSubmit();
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onMouseDown={onVoicePressStart}
                  onMouseUp={() => {
                    void onVoicePressEnd();
                  }}
                  className={`h-full flex-1 rounded-xl text-sm font-bold transition-all ${
                    isPressing
                      ? "scale-[0.98] bg-[#333] text-gray-400"
                      : "border border-[#222] bg-[#1a1a1a] text-gray-300"
                  }`}
                >
                  {isPressing ? "正在收音..." : "按住 说话"}
                </button>
              )}
            </div>

            {!showInteractionComposer && (
              <button
                className="p-2 text-gray-600"
                aria-label="add attachment"
                title="add attachment"
              >
                <Plus size={24} />
              </button>
            )}

            <button
              type="button"
              data-testid="send"
              onClick={() => {
                void onInputSubmit();
              }}
              className="rounded-full bg-cyan-600 p-2 text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-500"
              aria-label="send command"
              title="send command"
            >
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
