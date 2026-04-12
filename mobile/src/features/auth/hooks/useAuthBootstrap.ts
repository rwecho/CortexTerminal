import { useEffect } from "react";
import { useResetApplicationState } from "../../app/hooks/useResetApplicationState";
import { useAuthStore } from "../store/useAuthStore";
import { hydrateAuthenticationFromStoredSession } from "../authSessionService";

export function useAuthBootstrap() {
  const resetApplicationState = useResetApplicationState();
  const setIsAuthBootstrapping = useAuthStore(
    (state) => state.setIsAuthBootstrapping,
  );

  useEffect(() => {
    void hydrateAuthenticationFromStoredSession()
      .catch(() => {
        resetApplicationState();
      })
      .finally(() => {
        setIsAuthBootstrapping(false);
      });
  }, [resetApplicationState, setIsAuthBootstrapping]);
}
