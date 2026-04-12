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
      runtimeShortcutLabel={terminal.runtimeShortcutLabel}
      runtimeShortcuts={terminal.runtimeShortcuts}
      terminalInteraction={terminal.terminalInteraction}
      showInteractionComposer={terminal.showInteractionComposer}
      shouldHideDefaultComposer={terminal.shouldHideDefaultComposer}
      inputValue={terminal.inputValue}
      terminalHostRef={terminal.terminalHostRef}
      commandInputRef={terminal.commandInputRef}
      onBack={terminal.handleLeaveTerminal}
      onRuntimeShortcut={terminal.handleRuntimeShortcut}
      onInteractionAction={terminal.handleTerminalInteractionAction}
      onInputValueChange={terminal.setInputValue}
      onInputSubmit={terminal.handleSubmitInput}
      onReconnect={terminal.connectCurrentSession}
      onCloseInteractionComposer={() => {
        terminal.setIsInteractionCustomInputVisible(false);
        terminal.setInputValue("");
      }}
    />
  );
}
