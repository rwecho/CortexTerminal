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
];

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

export function isAuthFailure(message: string): boolean {
  return /(^|\b)(401|403)\b|unauthorized|forbidden|status code '?40[13]/i.test(
    message,
  );
}

export function inferAgentFamily(modelName?: string | null): AgentFamily {
  const normalized = modelName?.trim().toLowerCase() ?? "";

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

export function getAgentLabel(agent: AgentFamily): string {
  return agentOptions.find((option) => option.id === agent)?.label ?? agent;
}

export function buildSessionBootLogs(
  session: GatewaySession | null,
  worker: GatewayWorker | null,
): LogItem[] {
  const sessionLabel =
    session?.displayName ?? session?.sessionId ?? "未命名会话";
  const workerLabel = worker?.displayName ?? session?.workerId ?? "未绑定节点";
  const workingDirectory = session?.workingDirectory ?? "/claude";
  const agentLabel = getAgentLabel(inferAgentFamily(worker?.modelName));

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
