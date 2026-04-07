import { useEffect, useMemo } from "react";
import { createGatewayAuthClient } from "../../../lib/gatewayAuthClient";
import { gatewayTokenStorageKey, gatewayUrl } from "../../app/config";
import { useResetApplicationState } from "../../app/hooks/useResetApplicationState";
import { useAuthStore } from "../store/useAuthStore";

export function useAuthBootstrap() {
  const resetApplicationState = useResetApplicationState();
  const applyAuthentication = useAuthStore(
    (state) => state.applyAuthentication,
  );
  const setIsAuthBootstrapping = useAuthStore(
    (state) => state.setIsAuthBootstrapping,
  );
  const authClient = useMemo(() => createGatewayAuthClient(gatewayUrl), []);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(gatewayTokenStorageKey);

    if (!storedToken) {
      setIsAuthBootstrapping(false);
      return;
    }

    void authClient
      .me(storedToken)
      .then((principal) => {
        applyAuthentication(storedToken, principal);
      })
      .catch(() => {
        resetApplicationState();
      })
      .finally(() => {
        setIsAuthBootstrapping(false);
      });
  }, [
    applyAuthentication,
    authClient,
    resetApplicationState,
    setIsAuthBootstrapping,
  ]);
}
