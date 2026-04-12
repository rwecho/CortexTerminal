import { useCallback, useMemo } from "react";
import { createGatewayAuthClient } from "../../../lib/gatewayAuthClient";
import { gatewayUrl } from "../../app/config";
import { useAuthStore } from "../store/useAuthStore";
import { useResetApplicationState } from "../../app/hooks/useResetApplicationState";
import { createPersistedGatewayAuthSession } from "../authSessionStorage";

export function useAuthActions() {
  const resetApplicationState = useResetApplicationState();
  const authMode = useAuthStore((state) => state.authMode);
  const authUsername = useAuthStore((state) => state.authUsername);
  const authPassword = useAuthStore((state) => state.authPassword);
  const authDisplayName = useAuthStore((state) => state.authDisplayName);
  const authEmail = useAuthStore((state) => state.authEmail);
  const setAuthError = useAuthStore((state) => state.setAuthError);
  const setIsAuthenticating = useAuthStore(
    (state) => state.setIsAuthenticating,
  );
  const applyAuthentication = useAuthStore(
    (state) => state.applyAuthentication,
  );
  const authClient = useMemo(() => createGatewayAuthClient(gatewayUrl), []);

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
      applyAuthentication(
        createPersistedGatewayAuthSession(tokenResponse),
        principal,
      );
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
    setAuthError,
    setIsAuthenticating,
  ]);

  const handleSignOut = useCallback(() => {
    resetApplicationState();
  }, [resetApplicationState]);

  return {
    handleAuthenticate,
    handleSignOut,
  };
}
