import { useCallback, useMemo } from "react";
import { createGatewayAuthClient } from "../../../lib/gatewayAuthClient";
import { gatewayUrl } from "../../app/config";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";

export function useWorkerPairingActions() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const setWorkerRegistrationKey = useWorkerPairingStore(
    (state) => state.setWorkerRegistrationKey,
  );
  const setWorkerRegistrationKeyIssuedAtUtc = useWorkerPairingStore(
    (state) => state.setWorkerRegistrationKeyIssuedAtUtc,
  );
  const setWorkerRegistrationKeyError = useWorkerPairingStore(
    (state) => state.setWorkerRegistrationKeyError,
  );
  const setIsIssuingWorkerRegistrationKey = useWorkerPairingStore(
    (state) => state.setIsIssuingWorkerRegistrationKey,
  );
  const handleAuthFailure = useAuthFailureHandler();
  const authClient = useMemo(() => createGatewayAuthClient(gatewayUrl), []);

  const handleIssueWorkerRegistrationKey = useCallback(async () => {
    if (!accessToken) {
      setWorkerRegistrationKeyError(
        "当前登录态已失效，请重新登录后再生成 worker key。",
      );
      return;
    }

    try {
      setIsIssuingWorkerRegistrationKey(true);
      setWorkerRegistrationKeyError(null);

      const result = await authClient.issueWorkerRegistrationKey(accessToken);
      setWorkerRegistrationKey(result.registrationKey);
      setWorkerRegistrationKeyIssuedAtUtc(result.issuedAtUtc);
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setWorkerRegistrationKeyError(message);
      }
    } finally {
      setIsIssuingWorkerRegistrationKey(false);
    }
  }, [
    accessToken,
    authClient,
    handleAuthFailure,
    setIsIssuingWorkerRegistrationKey,
    setWorkerRegistrationKey,
    setWorkerRegistrationKeyError,
    setWorkerRegistrationKeyIssuedAtUtc,
  ]);

  return { handleIssueWorkerRegistrationKey };
}
