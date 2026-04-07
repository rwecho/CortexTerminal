import { useCallback, useMemo } from "react";
import { createGatewayAuthClient } from "../../../lib/gatewayAuthClient";
import { gatewayUrl } from "../../app/config";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";

export function useWorkerPairingActions() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const workerPairingCode = useWorkerPairingStore(
    (state) => state.workerPairingCode,
  );
  const setWorkerPairingError = useWorkerPairingStore(
    (state) => state.setWorkerPairingError,
  );
  const setWorkerPairingMessage = useWorkerPairingStore(
    (state) => state.setWorkerPairingMessage,
  );
  const setIsApprovingWorkerPairing = useWorkerPairingStore(
    (state) => state.setIsApprovingWorkerPairing,
  );
  const setWorkerPairingCode = useWorkerPairingStore(
    (state) => state.setWorkerPairingCode,
  );
  const handleAuthFailure = useAuthFailureHandler();
  const authClient = useMemo(() => createGatewayAuthClient(gatewayUrl), []);

  const handleApproveWorkerPairing = useCallback(async () => {
    const normalizedCode = workerPairingCode.trim().toUpperCase();
    if (!accessToken || !normalizedCode) {
      setWorkerPairingError(
        "请输入 worker pairing code。\nPlease enter the worker pairing code.",
      );
      return;
    }

    try {
      setIsApprovingWorkerPairing(true);
      setWorkerPairingError(null);
      setWorkerPairingMessage(null);

      const result = await authClient.activateWorkerDevice(
        accessToken,
        normalizedCode,
      );
      setWorkerPairingMessage(
        `Worker ${result.displayName} (${result.workerId}) 已授权，可在节点侧继续启动。`,
      );
      setWorkerPairingCode("");
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setWorkerPairingError(message);
      }
    } finally {
      setIsApprovingWorkerPairing(false);
    }
  }, [
    accessToken,
    authClient,
    handleAuthFailure,
    setIsApprovingWorkerPairing,
    setWorkerPairingCode,
    setWorkerPairingError,
    setWorkerPairingMessage,
    workerPairingCode,
  ]);

  return { handleApproveWorkerPairing };
}
