import { useCallback } from "react";
import { gatewayTokenStorageKey } from "../config";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useSessionsStore } from "../../sessions/store/useSessionsStore";
import { useAuditStore } from "../../audit/store/useAuditStore";
import { useWorkerPairingStore } from "../../settings/store/useWorkerPairingStore";
import { useTerminalStore } from "../../terminal/store/useTerminalStore";

export function resetApplicationState() {
  window.localStorage.removeItem(gatewayTokenStorageKey);
  useAuthStore.getState().clearAuthentication();
  useSessionsStore.getState().resetSessionsState();
  useAuditStore.getState().resetAuditState();
  useWorkerPairingStore.getState().resetWorkerPairingState();
  useTerminalStore.getState().resetTerminalState();
}

export function useResetApplicationState() {
  return useCallback(() => {
    resetApplicationState();
  }, []);
}
