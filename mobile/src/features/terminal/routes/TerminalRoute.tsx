import { TerminalPage } from "../TerminalPage";
import { useTerminalRuntime } from "../hooks/useTerminalRuntime";

export function TerminalRoute() {
  const terminal = useTerminalRuntime();

  return (
    <TerminalPage
      activeSession={terminal.activeSession}
      activeWorker={terminal.activeWorker}
      currentPath={terminal.currentPath}
      connectionState={terminal.connectionState}
      recoverySnapshot={terminal.recoverySnapshot}
      errorMessage={terminal.errorMessage}
      terminalInteraction={terminal.terminalInteraction}
      showInteractionComposer={terminal.showInteractionComposer}
      shouldHideDefaultComposer={terminal.shouldHideDefaultComposer}
      inputMode={terminal.inputMode}
      inputValue={terminal.inputValue}
      isPressing={terminal.isPressing}
      pendingAttachments={terminal.pendingAttachments}
      terminalHostRef={terminal.terminalHostRef}
      commandInputRef={terminal.commandInputRef}
      onBack={terminal.handleLeaveTerminal}
      onInteractionAction={terminal.handleTerminalInteractionAction}
      onInputModeToggle={() =>
        terminal.setInputMode((current) =>
          current === "text" ? "voice" : "text",
        )
      }
      onInputValueChange={terminal.setInputValue}
      onInputSubmit={terminal.handleSubmitInput}
      onAddAttachment={terminal.handleAddAttachment}
      onRemoveAttachment={terminal.handleRemoveAttachment}
      onVoicePressStart={terminal.handleVoicePressStart}
      onVoicePressEnd={terminal.handleVoiceRelease}
      onRunDoctor={terminal.handleRunDoctor}
      onReconnect={terminal.connectCurrentSession}
      onCloseInteractionComposer={() => {
        terminal.setIsInteractionCustomInputVisible(false);
        terminal.setInputValue("");
      }}
    />
  );
}
