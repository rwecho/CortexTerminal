import { useMemo } from "react";
import { createGatewayManagementClient } from "../../../lib/gatewayManagementClient";
import { gatewayUrl } from "../config";
import { useAuthStore } from "../../auth/store/useAuthStore";

export function useManagementClient() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useMemo(
    () => createGatewayManagementClient(gatewayUrl, () => accessToken),
    [accessToken],
  );
}
