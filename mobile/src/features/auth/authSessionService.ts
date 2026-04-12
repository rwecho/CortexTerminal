import {
  createGatewayAuthClient,
  type GatewayPrincipal,
} from "../../lib/gatewayAuthClient";
import { gatewayUrl } from "../app/config";
import { resetApplicationState } from "../app/hooks/useResetApplicationState";
import {
  createPersistedGatewayAuthSession,
  loadPersistedGatewayAuthSession,
  shouldRefreshGatewayAuthSession,
} from "./authSessionStorage";
import { useAuthStore } from "./store/useAuthStore";

const authClient = createGatewayAuthClient(gatewayUrl);
const sessionExpiredMessage =
  "登录已过期，请重新登录。\nYour session expired. Please sign in again.";

let refreshSessionPromise: Promise<boolean> | null = null;

export async function hydrateAuthenticationFromStoredSession(): Promise<boolean> {
  const storedAuthSession = loadPersistedGatewayAuthSession();

  if (!storedAuthSession) {
    return false;
  }

  useAuthStore.getState().setAuthSession(storedAuthSession);

  if (shouldRefreshGatewayAuthSession(storedAuthSession, 0)) {
    return refreshAuthenticationSession();
  }

  try {
    const principal = await authClient.me(storedAuthSession.accessToken);
    useAuthStore.getState().applyAuthentication(storedAuthSession, principal);
    return true;
  } catch {
    if (storedAuthSession.refreshToken) {
      return refreshAuthenticationSession();
    }

    resetApplicationState();
    return false;
  }
}

export async function refreshAuthenticationSession(): Promise<boolean> {
  if (refreshSessionPromise) {
    return refreshSessionPromise;
  }

  const refreshToken =
    useAuthStore.getState().authSession?.refreshToken ??
    loadPersistedGatewayAuthSession()?.refreshToken ??
    null;

  if (!refreshToken) {
    return false;
  }

  refreshSessionPromise = (async () => {
    try {
      const tokenResponse = await authClient.refresh(refreshToken);
      const nextAuthSession = createPersistedGatewayAuthSession(
        tokenResponse,
        refreshToken,
      );
      const principal: GatewayPrincipal = await authClient.me(
        nextAuthSession.accessToken,
      );

      useAuthStore.getState().applyAuthentication(nextAuthSession, principal);
      return true;
    } catch {
      resetApplicationState();
      useAuthStore.getState().setAuthError(sessionExpiredMessage);
      return false;
    } finally {
      refreshSessionPromise = null;
    }
  })();

  return refreshSessionPromise;
}

export async function getValidAccessToken(): Promise<string | null> {
  const authSession = useAuthStore.getState().authSession;

  if (!authSession) {
    return null;
  }

  if (shouldRefreshGatewayAuthSession(authSession)) {
    const refreshed = await refreshAuthenticationSession();
    if (!refreshed) {
      return null;
    }
  }

  return useAuthStore.getState().accessToken;
}
