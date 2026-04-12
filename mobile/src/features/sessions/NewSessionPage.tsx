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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  doesWorkerSupportAgentFamily,
  getAgentLabel,
  getPathLabel,
  getWorkerSupportedAgentFamilies,
  toUserFacingManagementError,
} from "../app/appUtils";
import type { AgentFamily } from "../app/appTypes";
import { WorkerDirectoryPicker } from "./components/WorkerDirectoryPicker";

type NewSessionPageProps = {
  workers: GatewayWorker[];
  selectedAgentFamily: AgentFamily;
  availableAgentFamilies: AgentFamily[];
  selectedWorkerId: string;
  selectedPath: string;
  isCreatingSession: boolean;
  managementError: string | null;
  onBack: () => void;
  onOpenWorkerGuide: () => void;
  onAgentFamilyChange: (value: AgentFamily) => void;
  onWorkerChange: (value: string) => void;
  onPathChange: (value: string) => void;
  onCreateSession: () => void | Promise<void>;
};

export function NewSessionPage({
  workers,
  selectedAgentFamily,
  availableAgentFamilies,
  selectedWorkerId,
  selectedPath,
  isCreatingSession,
  managementError,
  onBack,
  onOpenWorkerGuide,
  onAgentFamilyChange,
  onWorkerChange,
  onPathChange,
  onCreateSession,
}: NewSessionPageProps) {
  const onlineWorkers = workers.filter((worker) => worker.isOnline);
  const displayManagementError = managementError
    ? toUserFacingManagementError(managementError)
    : null;
  const selectedWorker =
    onlineWorkers.find((worker) => worker.workerId === selectedWorkerId) ??
    null;
  const selectedWorkerAgentFamilies =
    getWorkerSupportedAgentFamilies(selectedWorker);
  const visibleAgentFamilies = selectedWorker
    ? availableAgentFamilies.filter((agentFamily) =>
        selectedWorkerAgentFamilies.includes(agentFamily),
      )
    : availableAgentFamilies;
  const canCreateSession =
    !isCreatingSession &&
    !!selectedWorker &&
    !!selectedPath &&
    doesWorkerSupportAgentFamily(selectedWorker, selectedAgentFamily);

  return (
    <PageShell
      title="创建会话"
      subtitle="需要自定义节点、runtime 或目录时，再用这个页面。"
      onBack={onBack}
      backLabel="back to home"
      headerAccessory={
        <div className="rounded-2xl border border-cyan-900/30 bg-cyan-950/10 px-3 py-2 text-sm text-white">
          {getAgentLabel(selectedAgentFamily)}
        </div>
      }
    >
      <div className="space-y-5">
        {displayManagementError && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {displayManagementError}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>会话配置</CardTitle>
            <CardDescription>保留必要项，其他都交给默认值。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {onlineWorkers.length === 0 && (
              <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-4 py-3 text-sm text-gray-300">
                <div className="font-medium text-white">没有在线节点</div>
                <div className="mt-1 text-[12px] text-gray-400">
                  先生成安装命令，在电脑终端执行一次即可接入。
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onOpenWorkerGuide}
                  className="mt-3"
                >
                  去安装 Worker
                </Button>
              </div>
            )}

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
                <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-3 py-3 text-sm text-gray-500">
                  当前没有在线节点。
                </div>
              )}
            </label>

            {!selectedWorker && onlineWorkers.length > 0 && (
              <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <div>先选一个在线 worker，再选 runtime。</div>
                </div>
              </div>
            )}

            {selectedWorker && (
              <div className="rounded-2xl border border-cyan-900/30 bg-cyan-950/10 px-4 py-3 text-sm text-cyan-100">
                当前节点支持：
                {selectedWorkerAgentFamilies
                  .map((agentFamily) => getAgentLabel(agentFamily))
                  .join(" / ")}
              </div>
            )}

            <label className="space-y-2 text-[11px] text-gray-400">
              <span>运行环境</span>
              {selectedWorker ? (
                <div className="grid grid-cols-2 gap-2">
                  {visibleAgentFamilies.map((agentFamily) => {
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
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-3 py-3 text-sm text-gray-500">
                  请先选择执行节点。
                </div>
              )}
            </label>

            {selectedWorker && (
              <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                  <Server size={14} /> 当前节点
                </div>
                <div className="mt-2 wrap-break-word text-sm font-semibold text-white">
                  {selectedWorker.displayName}
                </div>
                <div className="mt-1 wrap-break-word text-sm text-gray-400">
                  {selectedWorker.modelName ??
                    getAgentLabel(selectedAgentFamily)}
                </div>
              </div>
            )}

            <label className="space-y-1 text-[11px] text-gray-400">
              <span>工作目录</span>
              <div className="text-[11px] text-gray-500">
                不再手填路径，直接从 worker 所在电脑的真实目录树里选择。
              </div>
              <WorkerDirectoryPicker
                worker={selectedWorker}
                selectedPath={selectedPath}
                onPathChange={onPathChange}
              />
            </label>

            <div className="rounded-2xl border border-[#1f2a30] bg-[#0a0f12] px-4 py-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                <FolderTree size={14} /> 目录预览
              </div>
              <div className="mt-2 break-all font-mono text-[12px] text-cyan-300">
                {selectedPath || "暂无可选路径"}
              </div>
            </div>

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
