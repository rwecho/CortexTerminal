import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Code2,
  FolderTree,
  Sparkles,
  Plus,
  Server,
  Terminal,
  Trash2,
  Unplug,
} from "lucide-react";
import type { GatewayPrincipal } from "../../lib/gatewayAuthClient";
import type {
  GatewaySession,
  GatewayWorker,
} from "../../lib/gatewayManagementClient";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  getPathLabel,
  getWorkerSupportedAgentFamilies,
  toUserFacingManagementError,
} from "../app/appUtils";

type HomePageProps = {
  currentPrincipal: GatewayPrincipal | null;
  managementError: string | null;
  isLoadingManagement: boolean;
  sessions: GatewaySession[];
  workers: GatewayWorker[];
  activeSessionId: string | null;
  isDeletingSessionId: string | null;
  isDeletingWorkerId: string | null;
  isQuickStartingWorkerId: string | null;
  onOpenNewSession: () => void;
  onOpenSession: (session: GatewaySession) => void | Promise<void>;
  onDeleteSession: (session: GatewaySession) => void | Promise<void>;
  onDeleteWorker: (worker: GatewayWorker) => void | Promise<void>;
  onQuickStartWorker: (worker: GatewayWorker) => void | Promise<void>;
};

function getWorkerStatusMessage(worker: GatewayWorker) {
  if (worker.isOnline) {
    return "可立即进入";
  }

  if (worker.lastHeartbeatAtUtc) {
    return `最近在线 ${new Date(worker.lastHeartbeatAtUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return "等待连接";
}

function getWorkerDefaultPath(worker: GatewayWorker) {
  return worker.availablePaths[0] ?? "~";
}

function getWorkerRuntimeIcons(worker: GatewayWorker) {
  return getWorkerSupportedAgentFamilies(worker).slice(0, 3);
}

function RuntimeIcon({
  family,
}: {
  family: "claude" | "codex" | "gemini" | "opencode" | "copilot";
}) {
  const sharedClassName = "h-3.5 w-3.5";

  switch (family) {
    case "copilot":
      return <Bot className={sharedClassName} />;
    case "codex":
      return <Code2 className={sharedClassName} />;
    case "opencode":
      return <Terminal className={sharedClassName} />;
    case "gemini":
      return <Sparkles className={sharedClassName} />;
    case "claude":
    default:
      return <Bot className={sharedClassName} />;
  }
}

export function HomePage({
  currentPrincipal,
  managementError,
  isLoadingManagement,
  sessions,
  workers,
  activeSessionId,
  isDeletingSessionId,
  isDeletingWorkerId,
  isQuickStartingWorkerId,
  onOpenNewSession,
  onOpenSession,
  onDeleteSession,
  onDeleteWorker,
  onQuickStartWorker,
}: HomePageProps) {
  const onlineWorkerCount = workers.filter((worker) => worker.isOnline).length;
  const activeSessionCount = sessions.filter(
    (session) => session.isActive,
  ).length;
  const displayManagementError = managementError
    ? toUserFacingManagementError(managementError)
    : null;
  const orderedWorkers = [...workers].sort(
    (left, right) => Number(right.isOnline) - Number(left.isOnline),
  );
  const orderedSessions = [...sessions].sort(
    (left, right) => Number(right.isActive) - Number(left.isActive),
  );

  return (
    <PageShell
      title="工作台"
      subtitle={`当前登录：${currentPrincipal?.displayName ?? currentPrincipal?.username ?? "未知用户"}`}
      headerAccessory={
        <Button type="button" onClick={onOpenNewSession} className="shrink-0">
          <Plus size={16} /> 新建会话
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-gray-400">
          <span className="font-medium text-white">{onlineWorkerCount}</span>
          <span>在线节点</span>
          <span className="text-gray-600">·</span>
          <span className="font-medium text-white">{activeSessionCount}</span>
          <span>活跃会话</span>
          <span className="text-gray-600">·</span>
          <span className="font-medium text-white">{sessions.length}</span>
          <span>全部会话</span>
        </div>

        {displayManagementError && (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-100">
            {displayManagementError}
          </div>
        )}

        {isLoadingManagement && (
          <div className="px-1 text-xs text-gray-500">
            正在同步最新节点与会话状态…
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-semibold text-gray-400">节点</h2>
          <span className="text-[11px] text-gray-500">{workers.length} 个</span>
        </div>

        {workers.length === 0 && (
          <Card className="border-dashed border-[#29323a] bg-[#0c1114]">
            <CardContent className="px-4 py-8 text-center text-sm text-gray-500">
              还没有任何 worker，先去接入一台设备或电脑。
            </CardContent>
          </Card>
        )}

        {orderedWorkers.map((worker) => {
          const isQuickStarting = isQuickStartingWorkerId === worker.workerId;
          const quickStartPath = getWorkerDefaultPath(worker);
          const runtimeFamilies = getWorkerRuntimeIcons(worker);

          return (
            <Card
              key={worker.workerId}
              className={`rounded-2xl border px-4 py-3 transition-colors ${
                worker.isOnline
                  ? "border-cyan-900/30 bg-[#0e1216]"
                  : "border-[#222] bg-[#111]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  disabled={!worker.isOnline || isQuickStarting}
                  onClick={() => {
                    void onQuickStartWorker(worker);
                  }}
                  className={`min-w-0 flex-1 text-left ${worker.isOnline ? "" : "cursor-default"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-xl p-2 ${worker.isOnline ? "bg-cyan-950/30 text-cyan-400" : "bg-[#181818] text-gray-400"}`}
                    >
                      <Server size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-bold text-white">
                          {worker.displayName}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          {runtimeFamilies.map((family) => (
                            <div
                              key={`${worker.workerId}-${family}`}
                              className="rounded-lg border border-[#25323a] bg-[#10171b] p-1.5"
                              title={family}
                              aria-label={family}
                            >
                              <RuntimeIcon family={family} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <span>{getPathLabel(quickStartPath)}</span>
                        {worker.availablePaths.length > 1 ? (
                          <span>· {worker.availablePaths.length} 个目录</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <div className="text-gray-500">
                      {getWorkerStatusMessage(worker)}
                    </div>
                    {worker.isOnline ? (
                      <div className="flex items-center gap-1 text-cyan-300">
                        <span>{isQuickStarting ? "进入中..." : "进入"}</span>
                        <ArrowUpRight size={14} />
                      </div>
                    ) : null}
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  {worker.isOnline ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-gray-700" />
                  )}
                </div>
              </div>

              {!worker.isOnline && (
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={isDeletingWorkerId === worker.workerId}
                    onClick={() => {
                      void onDeleteWorker(worker);
                    }}
                  >
                    <Unplug size={14} />
                    {isDeletingWorkerId === worker.workerId
                      ? "清理中..."
                      : "清理离线节点"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </section>

      <section className="space-y-4 pb-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-semibold text-gray-400">最近会话</h2>
          <span className="text-[11px] text-gray-500">
            {sessions.length} 个
          </span>
        </div>

        {sessions.length === 0 && (
          <Card className="border-dashed border-[#29323a] bg-[#0c1114]">
            <CardContent className="px-4 py-8 text-center text-sm text-gray-500">
              还没有会话。
            </CardContent>
          </Card>
        )}

        {orderedSessions.map((session) => {
          const worker =
            workers.find(
              (candidate) => candidate.workerId === session.workerId,
            ) ?? null;
          const isActiveSession = session.sessionId === activeSessionId;

          return (
            <Card
              key={session.sessionId}
              className={`rounded-2xl border px-4 py-3 transition-colors ${
                isActiveSession
                  ? "border-cyan-700/50 bg-cyan-950/10"
                  : "border-[#222] bg-[#111]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void onOpenSession(session);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[#181818] p-2 text-cyan-500">
                      <FolderTree size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white">
                        {session.displayName ?? session.sessionId}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                        <span className="rounded-full border border-[#24313a] bg-[#0d1519] px-2 py-1 text-gray-300">
                          {worker?.displayName ??
                            session.workerId ??
                            "未绑定节点"}
                        </span>
                        <span className="rounded-full border border-[#242424] px-2 py-1 text-gray-300">
                          {(session.agentFamily ?? "default").toUpperCase()}
                        </span>
                        <span>
                          {getPathLabel(
                            session.workingDirectory ?? "未设置工作目录",
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void onDeleteSession(session);
                  }}
                  disabled={isDeletingSessionId === session.sessionId}
                  className="border border-red-900/30 bg-red-950/10 text-red-300 hover:bg-red-950/20"
                  aria-label={`delete ${session.displayName ?? session.sessionId}`}
                  title="delete session"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
