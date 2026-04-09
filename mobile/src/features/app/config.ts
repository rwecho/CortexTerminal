import {
  formatStartupVersionLabel,
  getStartupConfig,
  getStartupAppBuild,
  getStartupAppVersion,
  getStartupGatewayUrl,
} from "../native/startup/nativeStartup";

export const gatewayUrl = getStartupGatewayUrl();
export const appVersion = getStartupAppVersion();
export const appBuild = getStartupAppBuild();
export const appVersionLabel = `v${appVersion} (${appBuild})`;

export function getAppVersionLabel(): string {
  return formatStartupVersionLabel(getStartupConfig());
}

export const gatewayTokenStorageKey = "cortex-terminal.gateway.accessToken";
