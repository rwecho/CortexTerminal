import { Fingerprint } from "lucide-react";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AuditPage } from "./features/audit/AuditPage";
import { useMobileAppController } from "./features/app/useMobileAppController";
import { BottomNavigation } from "./features/layout/BottomNavigation";
import { HomePage } from "./features/sessions/HomePage";
import { NewSessionPage } from "./features/sessions/NewSessionPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { WorkerPairingPage } from "./features/settings/WorkerPairingPage";
import { TerminalPage } from "./features/terminal/TerminalPage";

export default function App() {
  const controller = useMobileAppController();

  if (controller.isAuthBootstrapping) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-600/30 bg-cyan-600/20">
          <Fingerprint size={48} className="animate-pulse text-cyan-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-white italic">
            CORTEX TERMINAL
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            正在恢复登录态… Restoring authenticated session…
          </p>
        </div>
      </div>
    );
  }

  if (!controller.isAppLoggedIn) {
    return (
      <AuthScreen
        authMode={controller.authMode}
        authUsername={controller.authUsername}
        authPassword={controller.authPassword}
        authDisplayName={controller.authDisplayName}
        authEmail={controller.authEmail}
        authError={controller.authError}
        isAuthenticating={controller.isAuthenticating}
        onAuthModeChange={controller.setAuthMode}
        onAuthUsernameChange={controller.setAuthUsername}
        onAuthPasswordChange={controller.setAuthPassword}
        onAuthDisplayNameChange={controller.setAuthDisplayName}
        onAuthEmailChange={controller.setAuthEmail}
        onSubmit={controller.handleAuthenticate}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black font-sans text-white select-none">
      <div className="relative flex flex-1 flex-col">
        {controller.activeView === "home" && (
          <HomePage
            currentPrincipal={controller.currentPrincipal}
            managementError={controller.managementError}
            isLoadingManagement={controller.isLoadingManagement}
            sessions={controller.sessions}
            workers={controller.workers}
            activeSessionId={controller.activeSessionId}
            isDeletingSessionId={controller.isDeletingSessionId}
            isDeletingWorkerId={controller.isDeletingWorkerId}
            onOpenNewSession={() => controller.setActiveView("newSession")}
            onOpenSession={controller.openSession}
            onDeleteSession={controller.handleDeleteSession}
            onDeleteWorker={controller.handleDeleteWorker}
          />
        )}

        {controller.activeView === "newSession" && (
          <NewSessionPage
            workers={controller.workers}
            selectedAgentFamily={controller.newSessionAgentFamily}
            availableAgentFamilies={controller.availableAgentFamilies}
            selectedWorkerId={controller.newSessionWorkerId}
            selectedPath={controller.newSessionPath}
            sessionDisplayName={controller.newSessionDisplayName}
            isCreatingSession={controller.isCreatingSession}
            managementError={controller.managementError}
            onBack={() => controller.setActiveView("home")}
            onAgentFamilyChange={controller.setNewSessionAgentFamily}
            onWorkerChange={controller.setNewSessionWorkerId}
            onPathChange={controller.setNewSessionPath}
            onSessionDisplayNameChange={controller.setNewSessionDisplayName}
            onCreateSession={controller.handleCreateSession}
          />
        )}

        {controller.activeView === "terminal" && (
          <TerminalPage
            activeSession={controller.activeSession}
            activeWorker={controller.activeWorker}
            currentPath={controller.currentPath}
            connectionState={controller.connectionState}
            errorMessage={controller.managementError}
            terminalInteraction={controller.terminalInteraction}
            showInteractionComposer={controller.showInteractionComposer}
            shouldHideDefaultComposer={controller.shouldHideDefaultComposer}
            inputMode={controller.inputMode}
            inputValue={controller.inputValue}
            isPressing={controller.isPressing}
            terminalHostRef={controller.terminalHostRef}
            commandInputRef={controller.commandInputRef}
            onBack={controller.handleLeaveTerminal}
            onInteractionAction={controller.handleTerminalInteractionAction}
            onInputModeToggle={() =>
              controller.setInputMode((current) =>
                current === "text" ? "voice" : "text",
              )
            }
            onInputValueChange={controller.setInputValue}
            onInputSubmit={controller.handleSubmitInput}
            onVoicePressStart={() => controller.setIsPressing(true)}
            onVoicePressEnd={controller.handleVoiceRelease}
            onCloseInteractionComposer={() => {
              controller.setIsInteractionCustomInputVisible(false);
              controller.setInputValue("");
            }}
          />
        )}

        {controller.activeView === "audit" && (
          <AuditPage
            entries={controller.auditEntries}
            isLoading={controller.isLoadingAudit}
            error={controller.auditError}
          />
        )}

        {controller.activeView === "settings" && (
          <SettingsPage
            currentPrincipal={controller.currentPrincipal}
            onOpenPairWorker={() => controller.setActiveView("pairWorker")}
            onOpenAudit={() => controller.setActiveView("audit")}
            onSignOut={controller.handleSignOut}
          />
        )}

        {controller.activeView === "pairWorker" && (
          <WorkerPairingPage
            workerPairingCode={controller.workerPairingCode}
            workerPairingError={controller.workerPairingError}
            workerPairingMessage={controller.workerPairingMessage}
            isApprovingWorkerPairing={controller.isApprovingWorkerPairing}
            onBack={() => controller.setActiveView("settings")}
            onWorkerPairingCodeChange={controller.setWorkerPairingCode}
            onApprove={controller.handleApproveWorkerPairing}
          />
        )}
      </div>

      {controller.activeView !== "terminal" && (
        <BottomNavigation
          activeView={controller.activeView}
          onSelect={controller.handleSelectView}
        />
      )}

      <div className="hidden">
        <div data-testid="gateway-url">{controller.gatewayUrl}</div>
        <div data-testid="worker-id">
          {controller.activeWorker?.workerId ?? ""}
        </div>
        <div data-testid="session-id">
          {controller.activeSession?.sessionId ?? ""}
        </div>
        <div data-testid="trace-id">{controller.traceId}</div>
        <button
          data-testid="connect"
          onClick={() => {
            void controller.connectCurrentSession(
              controller.activeSession,
              controller.traceId,
            );
          }}
        >
          connect
        </button>
        <button
          data-testid="disconnect"
          onClick={() => void controller.disconnectCurrentServer()}
        >
          disconnect
        </button>
      </div>
    </div>
  );
}
