export type AccessTokenProvider = () => string | null;

export type GatewayWorker = {
  workerId: string;
  displayName: string;
  modelName?: string | null;
  availablePaths: string[];
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
  workingDirectory: string;
  traceId?: string;
};

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
      const response = await fetch(`${apiBaseUrl}/workers`, {
        headers: createHeaders(accessTokenProvider),
      });
      return readJsonOrThrow<GatewayWorker[]>(response);
    },

    async listSessions(): Promise<GatewaySession[]> {
      const response = await fetch(`${apiBaseUrl}/sessions`, {
        headers: createHeaders(accessTokenProvider),
      });
      return readJsonOrThrow<GatewaySession[]>(response);
    },

    async createSession(
      payload: CreateGatewaySessionPayload,
    ): Promise<GatewaySession> {
      const response = await fetch(`${apiBaseUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...createHeaders(accessTokenProvider),
        },
        body: JSON.stringify(payload),
      });

      return readJsonOrThrow<GatewaySession>(response);
    },

    async closeSession(sessionId: string): Promise<GatewaySession> {
      const response = await fetch(
        `${apiBaseUrl}/sessions/${encodeURIComponent(sessionId)}/close`,
        {
          method: "POST",
          headers: createHeaders(accessTokenProvider),
        },
      );

      return readJsonOrThrow<GatewaySession>(response);
    },

    async deleteWorker(workerId: string): Promise<void> {
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
    },

    async listAuditEntries(take = 100): Promise<GatewayAuditEntry[]> {
      const response = await fetch(
        `${apiBaseUrl}/audit?take=${encodeURIComponent(String(take))}`,
        {
          headers: createHeaders(accessTokenProvider),
        },
      );

      return readJsonOrThrow<GatewayAuditEntry[]>(response);
    },
  };
}
