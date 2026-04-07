import { Fingerprint } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthScreen } from "./features/auth/AuthScreen";
import { gatewayUrl } from "./features/app/config";
import { AppRuntime } from "./features/app/components/AppRuntime";
import { useAuthActions } from "./features/auth/hooks/useAuthActions";
import {
  useAuthStore,
  selectIsAppLoggedIn,
} from "./features/auth/store/useAuthStore";
import { AuditRoute } from "./features/audit/routes/AuditRoute";
import { BottomNavigationContainer } from "./features/layout/BottomNavigationContainer";
import { HomeRoute } from "./features/sessions/routes/HomeRoute";
import { NewSessionRoute } from "./features/sessions/routes/NewSessionRoute";
import { SettingsRoute } from "./features/settings/routes/SettingsRoute";
import { WorkerPairingRoute } from "./features/settings/routes/WorkerPairingRoute";
import { TerminalRoute } from "./features/terminal/routes/TerminalRoute";
import { useTerminalStore } from "./features/terminal/store/useTerminalStore";

export default function App() {
  const isAuthBootstrapping = useAuthStore(
    (state) => state.isAuthBootstrapping,
  );
  const isAppLoggedIn = useAuthStore(selectIsAppLoggedIn);
  const authMode = useAuthStore((state) => state.authMode);
  const authUsername = useAuthStore((state) => state.authUsername);
  const authPassword = useAuthStore((state) => state.authPassword);
  const authDisplayName = useAuthStore((state) => state.authDisplayName);
  const authEmail = useAuthStore((state) => state.authEmail);
  const authError = useAuthStore((state) => state.authError);
  const isAuthenticating = useAuthStore((state) => state.isAuthenticating);
  const setAuthMode = useAuthStore((state) => state.setAuthMode);
  const setAuthUsername = useAuthStore((state) => state.setAuthUsername);
  const setAuthPassword = useAuthStore((state) => state.setAuthPassword);
  const setAuthDisplayName = useAuthStore((state) => state.setAuthDisplayName);
  const setAuthEmail = useAuthStore((state) => state.setAuthEmail);
  const activeSessionId = useTerminalStore((state) => state.activeSessionId);
  const traceId = useTerminalStore((state) => state.traceId);
  const { handleAuthenticate } = useAuthActions();

  return (
    <>
      <AppRuntime />
      {isAuthBootstrapping ? (
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
      ) : !isAppLoggedIn ? (
        <AuthScreen
          authMode={authMode}
          authUsername={authUsername}
          authPassword={authPassword}
          authDisplayName={authDisplayName}
          authEmail={authEmail}
          authError={authError}
          isAuthenticating={isAuthenticating}
          onAuthModeChange={setAuthMode}
          onAuthUsernameChange={setAuthUsername}
          onAuthPasswordChange={setAuthPassword}
          onAuthDisplayNameChange={setAuthDisplayName}
          onAuthEmailChange={setAuthEmail}
          onSubmit={handleAuthenticate}
        />
      ) : (
        <div className="flex h-screen flex-col overflow-hidden bg-black font-sans text-white select-none">
          <div className="relative flex flex-1 flex-col">
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/sessions/new" element={<NewSessionRoute />} />
              <Route path="/sessions/:sessionId" element={<TerminalRoute />} />
              <Route path="/audit" element={<AuditRoute />} />
              <Route path="/settings" element={<SettingsRoute />} />
              <Route
                path="/settings/pair-worker"
                element={<WorkerPairingRoute />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <BottomNavigationContainer />

          <div className="hidden">
            <div data-testid="gateway-url">{gatewayUrl}</div>
            <div data-testid="session-id">{activeSessionId ?? ""}</div>
            <div data-testid="trace-id">{traceId}</div>
          </div>
        </div>
      )}
    </>
  );
}
