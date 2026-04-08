import { AlertCircle, FolderTree, Server } from "lucide-react";
import type { GatewayWorker } from "../../lib/gatewayManagementClient";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  getAgentLabel,
  getPathLabel,
  getWorkerSupportedAgentFamilies,
} from "../app/appUtils";
import type { AgentFamily } from "../app/appTypes";

type NewSessionPageProps = {
  workers: GatewayWorker[];
  selectedAgentFamily: AgentFamily;
  availableAgentFamilies: AgentFamily[];
  selectedWorkerId: string;
  selectedPath: string;
  sessionDisplayName: string;
  isCreatingSession: boolean;
  managementError: string | null;
  onBack: () => void;
  onAgentFamilyChange: (value: AgentFamily) => void;
  onWorkerChange: (value: string) => void;
  onPathChange: (value: string) => void;
  onSessionDisplayNameChange: (value: string) => void;
  onCreateSession: () => void | Promise<void>;
};

export function NewSessionPage({
  workers,
  selectedAgentFamily,
  availableAgentFamilies,
  selectedWorkerId,
  selectedPath,
  sessionDisplayName,
  isCreatingSession,
  managementError,
  onBack,
  onAgentFamilyChange,
  onWorkerChange,
  onPathChange,
  onSessionDisplayNameChange,
  onCreateSession,
}: NewSessionPageProps) {
  const onlineWorkers = workers.filter((worker) => worker.isOnline);
  const selectedWorker =
    onlineWorkers.find((worker) => worker.workerId === selectedWorkerId) ??
    null;
  const selectedWorkerAgentFamilies =
    getWorkerSupportedAgentFamilies(selectedWorker);
  const availablePaths = selectedWorker?.availablePaths ?? [];
  const canCreateSession =
    !isCreatingSession && !!selectedWorker && !!selectedPath;

  return (
    <PageShell
      title="创建会话"
      subtitle="先选执行节点，再选择本次会话要使用的 runtime 和工作目录；如节点未安装对应 CLI，可后续补装。"
      onBack={onBack}
      backLabel="back to home"
      headerAccessory={
        <div className="rounded-2xl border border-cyan-900/30 bg-cyan-950/10 px-3 py-2 text-sm text-white">
          {getAgentLabel(selectedAgentFamily)}
        </div>
      }
    >
      <div className="space-y-5">
        {managementError && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {managementError}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>会话配置</CardTitle>
            <CardDescription>
              仅保留创建会话所需的信息，避免无效步骤。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="space-y-2 text-[11px] text-gray-400">
              <span>执行节点</span>
              {onlineWorkers.length > 0 ? (
                <Select value={selectedWorkerId} onValueChange={onWorkerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择执行节点" />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineWorkers.map((worker) => {
                      const supportedAgentFamilies =
                        getWorkerSupportedAgentFamilies(worker);

                      return (
                        <SelectItem
                          key={worker.workerId}
                          value={worker.workerId}
                        >
                          {worker.displayName} ·{" "}
                          {supportedAgentFamilies
                            .map((agentFamily) => getAgentLabel(agentFamily))
                            .join(" / ")}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-xs text-gray-500">
                  当前没有可用节点，请先在设置中生成 Worker
                  Key，并确认节点已经启动且在线。
                </div>
              )}
            </label>

            {!selectedWorker && onlineWorkers.length > 0 && (
              <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    请先选择一个在线 worker，然后再选择本次会话要使用的
                    runtime。
                  </div>
                </div>
              </div>
            )}

            {selectedWorker && (
              <div className="rounded-2xl border border-cyan-900/30 bg-cyan-950/10 px-4 py-3 text-sm text-cyan-100">
                当前默认允许该 worker 创建任意 runtime 会话；若节点尚未安装对应
                CLI，可在节点侧补装后继续使用。
              </div>
            )}

            <label className="space-y-2 text-[11px] text-gray-400">
              <span>运行环境</span>
              {selectedWorker ? (
                <div className="grid grid-cols-2 gap-2">
                  {availableAgentFamilies.map((agentFamily) => {
                    const active = selectedAgentFamily === agentFamily;

                    return (
                      <Button
                        key={agentFamily}
                        type="button"
                        variant={active ? "default" : "secondary"}
                        onClick={() => onAgentFamilyChange(agentFamily)}
                        className="h-auto min-w-0 flex-col items-start px-3 py-3 text-left"
                      >
                        <div className="w-full wrap-break-word text-sm font-semibold">
                          {getAgentLabel(agentFamily)}
                        </div>
                        <div className="mt-2 w-full wrap-break-word text-[11px] font-normal leading-5 text-cyan-200/80">
                          选择本次会话运行的 CLI；如节点尚未安装，可后续补装。
                        </div>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-3 py-3 text-sm text-gray-500">
                  请选择执行节点后再选择 runtime。
                </div>
              )}
            </label>

            <Card className="border-[#1f2a30] bg-[#0a0f12]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                  <Server size={14} /> 节点摘要
                </div>
                <div className="mt-2 wrap-break-word text-sm font-semibold text-white">
                  {selectedWorker?.displayName ?? "未选择执行节点"}
                </div>
                <div className="mt-1 wrap-break-word text-sm text-gray-400">
                  {selectedWorker?.modelName ??
                    `${getAgentLabel(selectedAgentFamily)} 节点未接入`}
                </div>
                <div className="mt-2 wrap-break-word text-xs text-cyan-300/80">
                  {selectedWorker
                    ? `可选：${availableAgentFamilies
                        .map((agentFamily) => getAgentLabel(agentFamily))
                        .join(" / ")}`
                    : "请选择一个节点查看可选 runtime。"}
                </div>
              </CardContent>
            </Card>

            <label className="space-y-1 text-[11px] text-gray-400">
              <span>工作目录</span>
              {availablePaths.length > 0 ? (
                <Select value={selectedPath} onValueChange={onPathChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择工作目录" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePaths.map((path) => (
                      <SelectItem key={path} value={path}>
                        {getPathLabel(path)} · {path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-3 py-3 text-sm text-gray-500">
                  当前节点没有可用工作目录
                </div>
              )}
            </label>

            <Card className="border-[#1f2a30] bg-[#0a0f12]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                  <FolderTree size={14} /> 目录预览
                </div>
                <div className="mt-2 break-all font-mono text-[12px] text-cyan-300">
                  {selectedPath || "暂无可选路径"}
                </div>
              </CardContent>
            </Card>

            <label className="space-y-1 text-[11px] text-gray-400">
              <span>会话名称</span>
              <Input
                type="text"
                value={sessionDisplayName}
                onChange={(event) =>
                  onSessionDisplayNameChange(event.target.value)
                }
                placeholder={
                  selectedPath
                    ? `${getPathLabel(selectedPath)} 会话`
                    : "输入会话名称"
                }
              />
            </label>

            <Button
              type="button"
              onClick={() => {
                void onCreateSession();
              }}
              disabled={!canCreateSession}
              className="w-full"
            >
              {isCreatingSession ? "正在创建会话..." : "创建并进入终端"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
