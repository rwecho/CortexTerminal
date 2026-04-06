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

export type WorkerDeviceActivation = {
  workerId: string;
  displayName: string;
  userCode: string;
  approvedBy: string;
  approvedAtUtc: string;
};

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
    },

    async register(payload: RegisterGatewayUserPayload): Promise<void> {
      const response = await fetch(`${normalizedBaseUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      await readJsonOrThrow(response);
    },

    async me(accessToken: string): Promise<GatewayPrincipal> {
      const response = await fetch(`${normalizedBaseUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return readJsonOrThrow<GatewayPrincipal>(response);
    },

    async activateWorkerDevice(
      accessToken: string,
      userCode: string,
    ): Promise<WorkerDeviceActivation> {
      const response = await fetch(
        `${normalizedBaseUrl}/api/auth/worker/device/activate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userCode }),
        },
      );

      return readJsonOrThrow<WorkerDeviceActivation>(response);
    },
  };
}
