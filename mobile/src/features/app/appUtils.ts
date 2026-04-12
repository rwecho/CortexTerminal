import { ShieldCheck, User, Wifi } from "lucide-react";
import type {
  GatewaySession,
  GatewayWorker,
} from "../../lib/gatewayManagementClient";
import type { AgentFamily, AgentOption, LogItem, StatusItem } from "./appTypes";

export const agentOptions: AgentOption[] = [
  {
    id: "claude",
    label: "Claude",
    description: "适合代码编辑、重构与长上下文开发任务。",
  },
  {
    id: "codex",
    label: "Codex",
    description: "适合偏命令式的编码与脚本协作流程。",
  },
  {
    id: "gemini",
    label: "Gemini",
    description: "适合多模态分析与高推理强度任务。",
  },
  {
    id: "opencode",
    label: "OpenCode",
    description: "适合轻量终端协作与多节点代码处理流程。",
  },
  {
    id: "copilot",
    label: "Copilot",
    description: "适合 GitHub Copilot CLI 的交互式 coding / terminal 协作流程。",
  },
];

export const allAgentFamilies = agentOptions.map(
  (option) => option.id,
) as AgentFamily[];

export const authStatus: StatusItem[] = [
  { label: "User Identity", icon: User },
  { label: "Gateway Tunnel", icon: Wifi },
  { label: "Worker Authority", icon: ShieldCheck },
];

export function createTraceId(): string {
  return `trace-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function createRequestId(): string {
  return `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function getPathLabel(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments.at(-1) ?? path;
}

export function isPathWithinRoots(path: string, roots: string[]): boolean {
  return roots.some((root) => {
    if (!root) {
      return false;
    }

    if (path === root) {
      return true;
    }

    const separator = root.includes("\\") ? "\\" : "/";
    const rootPrefix = root.endsWith(separator) ? root : `${root}${separator}`;
    return path.startsWith(rootPrefix);
  });
}

export function isAuthFailure(message: string): boolean {
  return /(^|\b)(401|403)\b|unauthorized|forbidden|status code '?40[13]/i.test(
    message,
  );
}

export function toUserFacingManagementError(message: string): string {
  const normalizedMessage = message.trim();
  const lowerMessage = normalizedMessage.toLowerCase();

  if (
    lowerMessage.includes("reconnect retries have been exhausted") ||
    lowerMessage.includes("stopped during negotiation")
  ) {
    return "节点连接已中断，正在等待重新建立连接。";
  }

  if (
    lowerMessage.includes("relayfrommobile") &&
    lowerMessage.includes("not connected")
  ) {
    return "执行节点当前未连接，暂时无法打开这个会话。";
  }

  if (lowerMessage.includes("not connected")) {
    return "连接尚未就绪，请稍后重试。";
  }

  if (lowerMessage.includes("offline")) {
    return "节点当前离线，请等待它重新上线。";
  }

  if (lowerMessage.includes("not allowed")) {
    return "当前目录不允许在这个节点上执行，请重新选择目录或节点。";
  }

  if (
    lowerMessage.includes("management") &&
    (lowerMessage.includes("closed") || lowerMessage.includes("disconnected"))
  ) {
    return "节点列表连接已断开，正在等待恢复。";
  }

  if (normalizedMessage.length > 120) {
    return "连接出现异常，请重试。";
  }

  return normalizedMessage;
}

export function inferAgentFamily(modelName?: string | null): AgentFamily {
  const normalized = modelName?.trim().toLowerCase() ?? "";

  if (normalized.includes("copilot")) {
    return "copilot";
  }

  if (normalized.includes("codex")) {
    return "codex";
  }

  if (normalized.includes("gemini")) {
    return "gemini";
  }

  if (normalized.includes("opencode") || normalized.includes("open code")) {
    return "opencode";
  }

  return "claude";
}

export function doesWorkerSupportAgentFamily(
  worker: GatewayWorker | null | undefined,
  agentFamily: AgentFamily,
): boolean {
  return getWorkerSupportedAgentFamilies(worker).includes(agentFamily);
}

export function getPreferredWorkerAgentFamily(
  worker: GatewayWorker | null | undefined,
): AgentFamily {
  return getWorkerSupportedAgentFamilies(worker)[0] ?? inferAgentFamily(worker?.modelName);
}

export function getAgentLabel(agent: AgentFamily): string {
  return agentOptions.find((option) => option.id === agent)?.label ?? agent;
}

export function getWorkerSupportedAgentFamilies(
  worker: GatewayWorker | null | undefined,
): AgentFamily[] {
  const detectedAgentFamilies = worker?.supportedAgentFamilies
    ?.map((family) => family.trim().toLowerCase())
    .filter((family): family is AgentFamily =>
      allAgentFamilies.includes(family),
    );

  if (!detectedAgentFamilies || detectedAgentFamilies.length === 0) {
    return [inferAgentFamily(worker?.modelName)];
  }

  return Array.from(new Set(detectedAgentFamilies));
}

export function buildSessionBootLogs(
  session: GatewaySession | null,
  worker: GatewayWorker | null,
): LogItem[] {
  const sessionLabel =
    session?.displayName ?? session?.sessionId ?? "未命名会话";
  const workerLabel = worker?.displayName ?? session?.workerId ?? "未绑定节点";
  const workingDirectory = session?.workingDirectory ?? "/claude";
  const sessionAgentFamily = session?.agentFamily as AgentFamily | undefined;
  const agentLabel = getAgentLabel(
    sessionAgentFamily ?? inferAgentFamily(worker?.modelName),
  );

  return [
    {
      type: "system",
      text: "连接校验完成：应用、网关与执行节点均已就绪。",
    },
    {
      type: "system",
      text: `当前会话：${sessionLabel} · 执行节点：${workerLabel}`,
    },
    {
      type: "ai",
      text: `[${agentLabel}] 正在准备工作目录：${workingDirectory}\r\n`,
    },
  ];
}
