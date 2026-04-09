export type AccessTokenProvider = () => string | null;

export type GatewayWorker = {
  workerId: string;
  displayName: string;
  modelName?: string | null;
  availablePaths: string[];
  supportedAgentFamilies: string[];
  lastKnownState: string;
  currentConnectionId?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  lastHeartbeatAtUtc?: string | null;
  isOnline: boolean;
};

export type GatewaySession = {
  sessionId: string;
  userId?: string | null;
  workerId?: string | null;
  displayName?: string | null;
  agentFamily?: string | null;
  workingDirectory?: string | null;
  state: string;
  mobileConnectionId?: string | null;
  traceId?: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  lastActivityAtUtc?: string | null;
  isActive: boolean;
};

export type GatewayAuditEntry = {
  id: string;
  category: string;
  kind: string;
  summary: string;
  actorType?: string | null;
  actorId?: string | null;
  sessionId?: string | null;
  workerId?: string | null;
  traceId?: string | null;
  payloadJson?: string | null;
  createdAtUtc: string;
};

export type CreateGatewaySessionPayload = {
  sessionId?: string;
  userId?: string | null;
  workerId: string;
  displayName?: string;
  agentFamily?: string;
  workingDirectory: string;
  traceId?: string;
};

function normalizeGatewayRequestError(
  error: unknown,
  gatewayBaseUrl: string,
): Error {
  if (
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(error.message)
  ) {
    return new Error(
      `无法连接 Gateway：${gatewayBaseUrl}\n请确认手机当前网络可以访问该地址，并且不要在真机环境中使用 localhost。`,
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) {
        detail = payload.message;
      }
    } catch {
      // ignore json parse errors and keep the HTTP status detail
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

function createHeaders(accessTokenProvider?: AccessTokenProvider): HeadersInit {
  const accessToken = accessTokenProvider?.();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function createGatewayManagementClient(
  gatewayBaseUrl: string,
  accessTokenProvider?: AccessTokenProvider,
) {
  const apiBaseUrl = `${gatewayBaseUrl.replace(/\/$/, "")}/api`;

  return {
    async listWorkers(): Promise<GatewayWorker[]> {
      try {
        const response = await fetch(`${apiBaseUrl}/workers`, {
          headers: createHeaders(accessTokenProvider),
        });
        return readJsonOrThrow<GatewayWorker[]>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, apiBaseUrl);
      }
    },

    async listSessions(): Promise<GatewaySession[]> {
      try {
        const response = await fetch(`${apiBaseUrl}/sessions`, {
          headers: createHeaders(accessTokenProvider),
        });
        return readJsonOrThrow<GatewaySession[]>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, apiBaseUrl);
      }
    },

    async createSession(
      payload: CreateGatewaySessionPayload,
    ): Promise<GatewaySession> {
      try {
        const response = await fetch(`${apiBaseUrl}/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...createHeaders(accessTokenProvider),
          },
          body: JSON.stringify(payload),
        });

        return readJsonOrThrow<GatewaySession>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, apiBaseUrl);
      }
    },

    async closeSession(sessionId: string): Promise<GatewaySession> {
      try {
        const response = await fetch(
          `${apiBaseUrl}/sessions/${encodeURIComponent(sessionId)}/close`,
          {
            method: "POST",
            headers: createHeaders(accessTokenProvider),
          },
        );

        return readJsonOrThrow<GatewaySession>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, apiBaseUrl);
      }
    },

    async deleteWorker(workerId: string): Promise<void> {
      try {
        const response = await fetch(
          `${apiBaseUrl}/workers/${encodeURIComponent(workerId)}`,
          {
            method: "DELETE",
            headers: createHeaders(accessTokenProvider),
          },
        );

        if (!response.ok) {
          await readJsonOrThrow(response);
        }
      } catch (error) {
        throw normalizeGatewayRequestError(error, apiBaseUrl);
      }
    },

    async listAuditEntries(take = 100): Promise<GatewayAuditEntry[]> {
      try {
        const response = await fetch(
          `${apiBaseUrl}/audit?take=${encodeURIComponent(String(take))}`,
          {
            headers: createHeaders(accessTokenProvider),
          },
        );

        return readJsonOrThrow<GatewayAuditEntry[]>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, apiBaseUrl);
      }
    },
  };
}
