type StartupPlatform =
  | "android"
  | "ios"
  | "maccatalyst"
  | "windows"
  | "browser"
  | "unknown";

export type StartupConfig = Readonly<{
  platform: StartupPlatform;
  isNativeShell: boolean;
  useHashRouter: boolean;
  gatewayUrl: string;
  appVersion: string;
  appBuild: string;
}>;

type NativeStartupConfigPayload = Partial<StartupConfig> & {
  error?: string;
};

function parseBridgePayload<T>(payload: unknown): T {
  if (typeof payload === "string") {
    return JSON.parse(payload) as T;
  }

  return payload as T;
}

const browserDevelopmentGatewayUrl = "http://localhost:5050";
const nativeShellGatewayUrl = "https://gateway.ct.rwecho.top";
const fallbackBrowserVersion = "web";
const fallbackBrowserBuild = "browser";

function hasNativeHostBridgeTransport(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (window.chrome && window.chrome.webview) ||
    (window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.webwindowinterop) ||
    window.hybridWebViewHost,
  );
}

export function isLikelyNativeShellHostRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.protocol === "file:" ||
    hasNativeHostBridgeTransport() ||
    window.location.hostname === "0.0.0.0"
  );
}

function resolveBrowserGatewayUrl(): string {
  return (
    import.meta.env.VITE_GATEWAY_BASE_URL ??
    (import.meta.env.PROD
      ? nativeShellGatewayUrl
      : browserDevelopmentGatewayUrl)
  );
}

function createBrowserStartupConfig(): StartupConfig {
  return {
    platform: "browser",
    isNativeShell: false,
    useHashRouter: false,
    gatewayUrl: resolveBrowserGatewayUrl(),
    appVersion: import.meta.env.DEV ? "dev" : fallbackBrowserVersion,
    appBuild: fallbackBrowserBuild,
  };
}

let startupConfig: StartupConfig = createBrowserStartupConfig();

function hasNativeInvokeBridge(): boolean {
  return hasNativeHostBridgeTransport();
}

function normalizeStartupConfig(
  config: Partial<StartupConfig> | null | undefined,
): StartupConfig {
  return {
    platform: config?.platform ?? "unknown",
    isNativeShell: config?.isNativeShell ?? true,
    useHashRouter: config?.useHashRouter ?? true,
    gatewayUrl: config?.gatewayUrl?.trim() || nativeShellGatewayUrl,
    appVersion: config?.appVersion?.trim() || "unknown",
    appBuild: config?.appBuild?.trim() || "0",
  } satisfies StartupConfig;
}

async function requestNativeStartupConfig(): Promise<StartupConfig | null> {
  if (!hasNativeInvokeBridge()) {
    return null;
  }

  const rawResponse = await window.HybridWebView!.InvokeDotNet!(
    "GetStartupConfigAsync",
  );
  const response = parseBridgePayload<NativeStartupConfigPayload>(rawResponse);

  if (response.error) {
    throw new Error(response.error);
  }

  return normalizeStartupConfig(response);
}

export function bootstrapStartupConfig(
  initialConfig?: Partial<StartupConfig> | null,
): StartupConfig {
  if (initialConfig) {
    startupConfig = normalizeStartupConfig(initialConfig);
    return startupConfig;
  }

  startupConfig = createBrowserStartupConfig();
  return startupConfig;
}

export async function refreshStartupConfig(): Promise<StartupConfig> {
  try {
    const nativeConfig = await requestNativeStartupConfig();

    if (nativeConfig) {
      startupConfig = nativeConfig;
      return startupConfig;
    }
  } catch (error) {
    console.warn("[startup] Failed to refresh native startup config.", error);
  }

  return startupConfig;
}

export function getStartupConfig(): StartupConfig {
  return startupConfig;
}

export function getStartupGatewayUrl(): string {
  return startupConfig.gatewayUrl;
}

export function getStartupAppVersion(): string {
  return startupConfig.appVersion;
}

export function getStartupAppBuild(): string {
  return startupConfig.appBuild;
}

export function isNativeStartupFallback(config: StartupConfig): boolean {
  return (
    isLikelyNativeShellHostRuntime() &&
    config.platform === "browser" &&
    config.appVersion === fallbackBrowserVersion &&
    config.appBuild === fallbackBrowserBuild
  );
}

export function formatStartupVersionLabel(config: StartupConfig): string {
  if (isNativeStartupFallback(config)) {
    return "原生版本信息不可用";
  }

  return `v${config.appVersion} (${config.appBuild})`;
}

export function shouldUseStartupHashRouter(): boolean {
  return startupConfig.useHashRouter;
}

export function isNativeStartupRuntime(): boolean {
  return startupConfig.isNativeShell;
}
