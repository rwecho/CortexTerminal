import * as signalR from "@microsoft/signalr";
import type { AccessTokenProvider } from "./gatewayManagementClient";

export interface ManagementRealtimeClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export function createManagementRealtimeClient(
  gatewayBaseUrl: string,
  accessTokenProvider: AccessTokenProvider,
  onWorkersChanged: () => void,
  onSessionsChanged: () => void,
): ManagementRealtimeClient {
  const hubUrl = `${gatewayBaseUrl.replace(/\/$/, "")}/hubs/management`;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => accessTokenProvider() ?? "",
    })
    .withAutomaticReconnect()
    .build();

  connection.on("WorkersChanged", onWorkersChanged);
  connection.on("SessionsChanged", onSessionsChanged);
  connection.onreconnected(() => connection.invoke("SubscribeOverview"));

  return {
    async connect() {
      if (connection.state === signalR.HubConnectionState.Disconnected) {
        await connection.start();
      }

      await connection.invoke("SubscribeOverview");
    },

    async disconnect() {
      if (connection.state !== signalR.HubConnectionState.Disconnected) {
        await connection.stop();
      }
    },

    isConnected() {
      return connection.state === signalR.HubConnectionState.Connected;
    },
  };
}
