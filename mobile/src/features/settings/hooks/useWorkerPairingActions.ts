import { useCallback, useMemo } from "react";
import { createGatewayAuthClient } from "../../../lib/gatewayAuthClient";
import { gatewayUrl } from "../../app/config";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";

export function useWorkerPairingActions() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setWorkerInstallCommand = useWorkerPairingStore(
    (state) => state.setWorkerInstallCommand,
  );
  const setWorkerInstallError = useWorkerPairingStore(
    (state) => state.setWorkerInstallError,
  );
  const setIsIssuingWorkerInstallToken = useWorkerPairingStore(
    (state) => state.setIsIssuingWorkerInstallToken,
  );
  const handleAuthFailure = useAuthFailureHandler();
  const authClient = useMemo(() => createGatewayAuthClient(gatewayUrl), []);

  const handleIssueWorkerInstallToken = useCallback(async () => {
    if (!accessToken) {
      setWorkerInstallError("当前登录态已失效，请重新登录后再生成安装命令。");
      return;
    }

    try {
      setIsIssuingWorkerInstallToken(true);
      setWorkerInstallError(null);

      const result = await authClient.issueWorkerInstallToken(accessToken);
      setWorkerInstallCommand(result.installCommand);
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setWorkerInstallError(message);
      }
    } finally {
      setIsIssuingWorkerInstallToken(false);
    }
  }, [
    accessToken,
    authClient,
    handleAuthFailure,
    setIsIssuingWorkerInstallToken,
    setWorkerInstallCommand,
    setWorkerInstallError,
  ]);

  return { handleIssueWorkerInstallToken };
}
