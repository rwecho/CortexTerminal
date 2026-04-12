export type GatewayTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export type GatewayPrincipal = {
  subject: string;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
  scopes: string[];
  clientId?: string | null;
};

export type RegisterGatewayUserPayload = {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
};

export type WorkerInstallCommandSet = {
  unixUrl: string;
  unixCommand: string;
  windowsUrl: string;
  windowsCommand: string;
};

export type WorkerInstallToken = {
  token: string;
  issuedAtUtc: string;
  expiresAtUtc: string;
  installUrl: string;
  installCommand: string;
  installCommands?: WorkerInstallCommandSet;
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

function toFormBody(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      params.set(key, value);
    }
  });

  return params.toString();
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;

    try {
      const payload = (await response.json()) as {
        message?: string;
        error?: string;
        error_description?: string;
        errors?: string[];
      };

      if (payload?.errors?.length) {
        detail = payload.errors.join(" ");
      } else if (payload?.message) {
        detail = payload.message;
      } else if (payload?.error_description) {
        detail = payload.error_description;
      } else if (payload?.error) {
        detail = payload.error;
      }
    } catch {
      // keep http status text as fallback
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export function createGatewayAuthClient(gatewayBaseUrl: string) {
  const normalizedBaseUrl = gatewayBaseUrl.replace(/\/$/, "");

  return {
    async login(
      username: string,
      password: string,
    ): Promise<GatewayTokenResponse> {
      try {
        const response = await fetch(`${normalizedBaseUrl}/connect/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: toFormBody({
            grant_type: "password",
            username,
            password,
            scope: "gateway.api relay.connect offline_access",
          }),
        });

        return readJsonOrThrow<GatewayTokenResponse>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, normalizedBaseUrl);
      }
    },

    async refresh(refreshToken: string): Promise<GatewayTokenResponse> {
      try {
        const response = await fetch(`${normalizedBaseUrl}/connect/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: toFormBody({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            scope: "gateway.api relay.connect offline_access",
          }),
        });

        return readJsonOrThrow<GatewayTokenResponse>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, normalizedBaseUrl);
      }
    },

    async register(payload: RegisterGatewayUserPayload): Promise<void> {
      try {
        const response = await fetch(`${normalizedBaseUrl}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        await readJsonOrThrow(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, normalizedBaseUrl);
      }
    },

    async me(accessToken: string): Promise<GatewayPrincipal> {
      try {
        const response = await fetch(`${normalizedBaseUrl}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        return readJsonOrThrow<GatewayPrincipal>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, normalizedBaseUrl);
      }
    },

    async issueWorkerInstallToken(
      accessToken: string,
    ): Promise<WorkerInstallToken> {
      try {
        const response = await fetch(
          `${normalizedBaseUrl}/api/auth/worker/install-token`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        return readJsonOrThrow<WorkerInstallToken>(response);
      } catch (error) {
        throw normalizeGatewayRequestError(error, normalizedBaseUrl);
      }
    },
  };
}
