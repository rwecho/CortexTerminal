import type {
  GatewaySession,
  GatewayWorker,
} from "../../lib/gatewayManagementClient";

export type TerminalConnectionState =
  | "idle"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error";

export type TerminalRecoveryPhase =
  | "booting"
  | "reattaching"
  | "reconnecting"
  | "detached"
  | "worker-offline"
  | "error";

export type TerminalRecoverySnapshot = {
  phase: TerminalRecoveryPhase;
  title: string;
  description: string;
  tone: "info" | "warning" | "danger";
  showRetry: boolean;
};

type DeriveTerminalRecoveryInput = {
  activeSession: GatewaySession | null;
  activeWorker: GatewayWorker | null;
  connectionState: TerminalConnectionState;
  errorMessage: string | null;
};

export function deriveTerminalRecoverySnapshot({
  activeSession,
  activeWorker,
  connectionState,
  errorMessage,
}: DeriveTerminalRecoveryInput): TerminalRecoverySnapshot | null {
  if (!activeSession) {
    return null;
  }

  if (connectionState === "error") {
    return {
      phase: "error",
      title: "连接失败",
      description:
        errorMessage ??
        "Terminal relay 遇到了未预期错误，请重试或重新选择 worker。",
      tone: "danger",
      showRetry: true,
    };
  }

  if (connectionState === "reconnecting") {
    return {
      phase: "reconnecting",
      title: "Relay 正在重连",
      description:
        "正在恢复与 gateway 的连接；连接恢复后会自动尝试重新附着当前 session。",
      tone: "warning",
      showRetry: false,
    };
  }

  if (connectionState === "connecting") {
    return {
      phase: activeSession.state === "Disconnected" ? "reattaching" : "booting",
      title:
        activeSession.state === "Disconnected"
          ? "正在重新附着会话"
          : "正在建立 terminal relay",
      description:
        activeSession.state === "Disconnected"
          ? "mobile 已重新连回，正在向 relay 重新注册当前 session。"
          : "正在连接 relay 并初始化当前 worker session。",
      tone: "info",
      showRetry: false,
    };
  }

  if (activeSession.state === "Disconnected") {
    return {
      phase: "detached",
      title: "Session 已与 mobile 脱附",
      description:
        "当前 session 在 gateway 侧处于 Disconnected。你可以手动重试附着；如果 worker 端 PTY 已被清理，下一步将需要 resume/fresh 决策。",
      tone: "warning",
      showRetry: true,
    };
  }

  if (activeWorker && !activeWorker.isOnline && connectionState === "idle") {
    return {
      phase: "worker-offline",
      title: "Worker 当前离线",
      description:
        `节点 ${activeWorker.displayName} 当前不在线，terminal 无法继续附着。` +
        (activeWorker.lastHeartbeatAtUtc
          ? ` 最后心跳：${new Date(activeWorker.lastHeartbeatAtUtc).toLocaleString()}`
          : ""),
      tone: "danger",
      showRetry: false,
    };
  }

  if (connectionState === "idle") {
    return {
      phase: "booting",
      title: "准备连接",
      description: "terminal 会在后台自动连接当前 session。",
      tone: "info",
      showRetry: true,
    };
  }

  return null;
}
