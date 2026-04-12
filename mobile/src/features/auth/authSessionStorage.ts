import type { GatewayTokenResponse } from "../../lib/gatewayAuthClient";
import {
  gatewayAuthSessionStorageKey,
  gatewayTokenStorageKey,
} from "../app/config";

const fallbackAccessTokenLifetimeSeconds = 60 * 60;

export type PersistedGatewayAuthSession = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  scope?: string;
  accessTokenExpiresAtUtc: string;
};

export function createPersistedGatewayAuthSession(
  tokenResponse: GatewayTokenResponse,
  previousRefreshToken?: string | null,
): PersistedGatewayAuthSession {
  const expiresInSeconds = Math.max(
    tokenResponse.expires_in ?? fallbackAccessTokenLifetimeSeconds,
    60,
  );

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? previousRefreshToken ?? null,
    tokenType: tokenResponse.token_type,
    scope: tokenResponse.scope,
    accessTokenExpiresAtUtc: new Date(
      Date.now() + expiresInSeconds * 1000,
    ).toISOString(),
  };
}

export function persistGatewayAuthSession(
  authSession: PersistedGatewayAuthSession | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!authSession) {
    window.localStorage.removeItem(gatewayAuthSessionStorageKey);
    window.localStorage.removeItem(gatewayTokenStorageKey);
    return;
  }

  window.localStorage.setItem(
    gatewayAuthSessionStorageKey,
    JSON.stringify(authSession),
  );
  window.localStorage.setItem(gatewayTokenStorageKey, authSession.accessToken);
}

export function loadPersistedGatewayAuthSession(): PersistedGatewayAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSession = window.localStorage.getItem(gatewayAuthSessionStorageKey);
  if (!rawSession) {
    const legacyAccessToken = window.localStorage.getItem(
      gatewayTokenStorageKey,
    );

    if (!legacyAccessToken) {
      return null;
    }

    return {
      accessToken: legacyAccessToken,
      refreshToken: null,
      tokenType: "Bearer",
      accessTokenExpiresAtUtc: new Date(0).toISOString(),
    };
  }

  try {
    const parsed = JSON.parse(
      rawSession,
    ) as Partial<PersistedGatewayAuthSession>;

    if (
      !parsed.accessToken ||
      typeof parsed.accessToken !== "string" ||
      !parsed.accessTokenExpiresAtUtc ||
      typeof parsed.accessTokenExpiresAtUtc !== "string"
    ) {
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      tokenType:
        typeof parsed.tokenType === "string" && parsed.tokenType.length > 0
          ? parsed.tokenType
          : "Bearer",
      scope: typeof parsed.scope === "string" ? parsed.scope : undefined,
      accessTokenExpiresAtUtc: parsed.accessTokenExpiresAtUtc,
    };
  } catch {
    return null;
  }
}

export function shouldRefreshGatewayAuthSession(
  authSession: PersistedGatewayAuthSession | null,
  thresholdMs = 5 * 60 * 1000,
): boolean {
  if (!authSession?.refreshToken) {
    return false;
  }

  const expiresAt = Date.parse(authSession.accessTokenExpiresAtUtc);
  if (Number.isNaN(expiresAt)) {
    return true;
  }

  return expiresAt - Date.now() <= thresholdMs;
}
