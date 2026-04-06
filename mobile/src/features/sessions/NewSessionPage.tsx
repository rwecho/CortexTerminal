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
  agentOptions,
  getAgentLabel,
  getPathLabel,
  inferAgentFamily,
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
  const familyWorkers = workers.filter(
    (worker) => inferAgentFamily(worker.modelName) === selectedAgentFamily,
  );
  const onlineWorkers = familyWorkers.filter((worker) => worker.isOnline);
  const selectedWorker =
    onlineWorkers.find((worker) => worker.workerId === selectedWorkerId) ??
    null;
  const availablePaths = selectedWorker?.availablePaths ?? [];
  const hasOnlyOfflineWorkers =
    familyWorkers.length > 0 && onlineWorkers.length === 0;
  const canCreateSession =
    !isCreatingSession && !!selectedWorker && !!selectedPath;

  return (
    <PageShell
      title="创建会话"
      subtitle="选择运行环境、执行节点和工作目录，然后直接进入终端。"
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
              <span>运行环境</span>
              <div className="grid grid-cols-2 gap-2">
                {agentOptions.map((agent) => {
                  const active = selectedAgentFamily === agent.id;
                  const hasWorkers = workers.some(
                    (worker) => inferAgentFamily(worker.modelName) === agent.id,
                  );

                  return (
                    <Button
                      key={agent.id}
                      type="button"
                      variant={active ? "default" : "secondary"}
                      onClick={() => onAgentFamilyChange(agent.id)}
                      className="h-auto flex-col items-start px-3 py-3 text-left"
                    >
                      <div>{agent.label}</div>
                      <div className="mt-1 text-[11px] font-normal text-gray-300/80">
                        {hasWorkers
                          ? agent.description
                          : "已支持，等待节点接入"}
                      </div>
                    </Button>
                  );
                })}
              </div>
              {availableAgentFamilies.length === 0 && (
                <div className="text-xs text-gray-500">
                  当前尚未发现已注册节点，运行环境入口已预留。
                </div>
              )}
            </label>

            {hasOnlyOfflineWorkers && (
              <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    当前运行环境下已有节点注册，但都处于离线状态，暂时无法创建会话。
                  </div>
                </div>
              </div>
            )}

            <label className="space-y-1 text-[11px] text-gray-400">
              <span>执行节点</span>
              {onlineWorkers.length > 0 ? (
                <Select value={selectedWorkerId} onValueChange={onWorkerChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择执行节点" />
                  </SelectTrigger>
                  <SelectContent>
                    {onlineWorkers.map((worker) => (
                      <SelectItem key={worker.workerId} value={worker.workerId}>
                        {worker.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-3 py-3 text-sm text-gray-500">
                  {familyWorkers.length === 0
                    ? "当前运行环境下暂无可用节点"
                    : "当前节点均为离线状态"}
                </div>
              )}
            </label>

            <Card className="border-[#1f2a30] bg-[#0a0f12]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                  <Server size={14} /> 节点摘要
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {selectedWorker?.displayName ?? "未选择执行节点"}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {selectedWorker?.modelName ??
                    `${getAgentLabel(selectedAgentFamily)} workflow`}
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
