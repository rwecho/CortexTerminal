import { useCallback, useMemo } from "react";
import {
  createGatewayAuthClient,
  type WorkerInstallCommandSet,
} from "../../../lib/gatewayAuthClient";
import { gatewayUrl } from "../../app/config";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";

function resolveInstallCommands(
  installUrl: string,
  installCommand: string,
  installCommands?: WorkerInstallCommandSet,
): WorkerInstallCommandSet {
  if (installCommands) {
    return installCommands;
  }

  return {
    unixUrl: installUrl,
    unixCommand: installCommand,
    windowsUrl: installUrl.replace(
      /install-worker\.sh(?=\?)/,
      "install-worker.ps1",
    ),
    windowsCommand: "",
  };
}

export function useWorkerPairingActions() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setWorkerInstallCommands = useWorkerPairingStore(
    (state) => state.setWorkerInstallCommands,
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
      setWorkerInstallCommands(
        resolveInstallCommands(
          result.installUrl,
          result.installCommand,
          result.installCommands,
        ),
      );
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
    setWorkerInstallCommands,
    setWorkerInstallError,
  ]);

  return { handleIssueWorkerInstallToken };
}
