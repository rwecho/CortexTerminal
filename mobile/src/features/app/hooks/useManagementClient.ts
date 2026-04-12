import { useMemo } from "react";
import { createGatewayManagementClient } from "../../../lib/gatewayManagementClient";
import { gatewayUrl } from "../config";
import { getValidAccessToken } from "../../auth/authSessionService";

export function useManagementClient() {
  return useMemo(
    () => createGatewayManagementClient(gatewayUrl, getValidAccessToken),
    [],
  );
}
