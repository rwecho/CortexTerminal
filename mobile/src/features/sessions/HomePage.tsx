import {
  CheckCircle2,
  FolderTree,
  Plus,
  Server,
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
import { getPathLabel } from "../app/appUtils";

type HomePageProps = {
  currentPrincipal: GatewayPrincipal | null;
  managementError: string | null;
  isLoadingManagement: boolean;
  sessions: GatewaySession[];
  workers: GatewayWorker[];
  activeSessionId: string | null;
  isDeletingSessionId: string | null;
  isDeletingWorkerId: string | null;
  onOpenNewSession: () => void;
  onOpenSession: (session: GatewaySession) => void | Promise<void>;
  onDeleteSession: (session: GatewaySession) => void | Promise<void>;
  onDeleteWorker: (worker: GatewayWorker) => void | Promise<void>;
};

function getWorkerStatusMessage(worker: GatewayWorker) {
  if (worker.isOnline) {
    return worker.lastHeartbeatAtUtc
      ? `实时连接正常 · 持久状态 ${worker.lastKnownState} · 最近心跳 ${new Date(worker.lastHeartbeatAtUtc).toLocaleString()}`
      : `实时连接正常 · 持久状态 ${worker.lastKnownState}`;
  }

  if (worker.lastHeartbeatAtUtc) {
    return `当前无活跃 relay 连接 · 持久状态 ${worker.lastKnownState} · 最后心跳 ${new Date(worker.lastHeartbeatAtUtc).toLocaleString()}`;
  }

  return `尚未检测到有效心跳或 relay 连接 · 持久状态 ${worker.lastKnownState}`;
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
  onOpenNewSession,
  onOpenSession,
  onDeleteSession,
  onDeleteWorker,
}: HomePageProps) {
  const onlineWorkerCount = workers.filter((worker) => worker.isOnline).length;
  const activeSessionCount = sessions.filter(
    (session) => session.isActive,
  ).length;

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
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                会话
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {sessions.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                运行中
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {activeSessionCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                在线节点
              </div>
              <div className="mt-2 text-xl font-semibold text-green-400">
                {onlineWorkerCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                离线节点
              </div>
              <div className="mt-2 text-xl font-semibold text-gray-300">
                {workers.length - onlineWorkerCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {managementError && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {managementError}
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
          <h2 className="text-[11px] font-semibold text-gray-400">会话</h2>
          <span className="text-[11px] text-gray-500">
            {sessions.length} 个
          </span>
        </div>

        {sessions.length === 0 && (
          <Card className="border-dashed border-[#29323a] bg-[#0c1114]">
            <CardContent className="px-4 py-8 text-center text-sm text-gray-500">
              暂无会话。
            </CardContent>
          </Card>
        )}

        {sessions.map((session) => {
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
                    <div className="rounded-xl bg-[#181818] p-2.5 text-cyan-500">
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
                        <span>{session.isActive ? "活动中" : "已持久化"}</span>
                        <span>·</span>
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

              <div className="mt-3 truncate font-mono text-[10px] text-gray-600">
                {session.workingDirectory ?? "未设置工作目录"}
              </div>
            </Card>
          );
        })}
      </section>

      <section className="space-y-4 pb-6">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[11px] font-semibold text-gray-400">节点</h2>
          <span className="text-[11px] text-gray-500">{workers.length} 个</span>
        </div>

        {workers.map((worker) => (
          <Card
            key={worker.workerId}
            className="rounded-2xl border border-[#222] bg-[#111] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#181818] p-2.5 text-gray-400">
                  <Server size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">
                    {worker.displayName}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                    <span className="font-mono uppercase tracking-widest">
                      {worker.modelName ?? "Claude CLI"}
                    </span>
                    <span>·</span>
                    <span>{worker.availablePaths.length} 个目录</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {worker.isOnline ? (
                  <CheckCircle2 size={16} className="text-green-500" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-gray-700" />
                )}
                <span
                  className={`text-[11px] uppercase ${worker.isOnline ? "text-green-500" : "text-gray-500"}`}
                >
                  {worker.isOnline ? "在线" : "离线"}
                </span>
              </div>
            </div>

            <div className="mt-3 text-[10px] text-gray-500">
              {worker.availablePaths.length === 0 ? (
                "暂无可用工作目录"
              ) : (
                <>
                  <span className="text-gray-300">
                    {getPathLabel(worker.availablePaths[0])}
                  </span>
                  <span className="mx-1">·</span>
                  <span className="font-mono text-gray-600">
                    {worker.availablePaths[0]}
                  </span>
                </>
              )}
            </div>

            <div className="mt-2 text-[11px] text-gray-500">
              {getWorkerStatusMessage(worker)}
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
        ))}
      </section>
    </PageShell>
  );
}
