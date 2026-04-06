import * as signalR from "@microsoft/signalr";
import type { AccessTokenProvider } from "./gatewayManagementClient";

export type WorkerFrameHandler = (
  sessionId: string,
  payload: Uint8Array,
  metadata: { requestId?: string; traceId?: string },
) => void;

export type FrameMetadata = {
  requestId?: string;
  traceId?: string;
};

export interface RelayClient {
  connect(sessionId: string, workerId: string): Promise<void>;
  sendMobileFrame(
    sessionId: string,
    payload: Uint8Array,
    metadata?: FrameMetadata,
  ): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function normalizePayload(payload: unknown): Uint8Array {
  if (typeof payload === "string") {
    return decodeBase64(payload);
  }

  return new Uint8Array();
}

function encodeBase64(payload: Uint8Array): string {
  let binary = "";
  payload.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export function createRelayClient(
  gatewayBaseUrl: string,
  onWorkerFrame: WorkerFrameHandler,
  accessTokenProvider?: AccessTokenProvider,
): RelayClient {
  const hubUrl = `${gatewayBaseUrl.replace(/\/$/, "")}/hubs/relay`;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => accessTokenProvider?.() ?? "",
    })
    .withAutomaticReconnect()
    .build();

  connection.on(
    "ReceiveFromWorker",
    (
      sessionId: string,
      payload: unknown,
      requestId?: string,
      traceId?: string,
    ) => {
      onWorkerFrame(sessionId, normalizePayload(payload), {
        requestId,
        traceId,
      });
    },
  );

  return {
    async connect(sessionId, workerId) {
      if (connection.state === signalR.HubConnectionState.Disconnected) {
        await connection.start();
      }

      await connection.invoke("RegisterMobileSession", sessionId, workerId);
    },

    async sendMobileFrame(sessionId, payload, metadata) {
      await connection.invoke(
        "RelayFromMobile",
        sessionId,
        encodeBase64(payload),
        metadata?.requestId ?? null,
        metadata?.traceId ?? null,
      );
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
