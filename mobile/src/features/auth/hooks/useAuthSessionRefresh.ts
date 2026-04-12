import { useEffect } from "react";
import { selectIsAppLoggedIn, useAuthStore } from "../store/useAuthStore";
import { refreshAuthenticationSession } from "../authSessionService";
import { shouldRefreshGatewayAuthSession } from "../authSessionStorage";

export function useAuthSessionRefresh() {
  const isAppLoggedIn = useAuthStore(selectIsAppLoggedIn);
  const authSession = useAuthStore((state) => state.authSession);

  useEffect(() => {
    if (!isAppLoggedIn || !authSession) {
      return;
    }

    const expiresAtMs = Date.parse(authSession.accessTokenExpiresAtUtc);
    if (Number.isNaN(expiresAtMs)) {
      void refreshAuthenticationSession();
      return;
    }

    const refreshDelayMs = Math.max(
      expiresAtMs - Date.now() - 5 * 60 * 1000,
      15 * 1000,
    );

    const timeoutId = window.setTimeout(() => {
      void refreshAuthenticationSession();
    }, refreshDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authSession, isAppLoggedIn]);

  useEffect(() => {
    if (!isAppLoggedIn) {
      return;
    }

    const maybeRefresh = () => {
      const currentSession = useAuthStore.getState().authSession;
      if (!shouldRefreshGatewayAuthSession(currentSession)) {
        return;
      }

      void refreshAuthenticationSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        maybeRefresh();
      }
    };

    window.addEventListener("focus", maybeRefresh);
    window.addEventListener("pageshow", maybeRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    maybeRefresh();

    return () => {
      window.removeEventListener("focus", maybeRefresh);
      window.removeEventListener("pageshow", maybeRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAppLoggedIn]);
}
