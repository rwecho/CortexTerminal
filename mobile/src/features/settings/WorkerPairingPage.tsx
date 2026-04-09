import { useEffect, useMemo, useState } from "react";
import { Fingerprint, MonitorSmartphone } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import type { WorkerInstallCommandSet } from "../../lib/gatewayAuthClient";

type InstallPlatform = "unix" | "windows";

type WorkerPairingPageProps = {
  workerInstallCommands: WorkerInstallCommandSet | null;
  workerInstallError: string | null;
  isIssuingWorkerInstallToken: boolean;
  defaultInstallPlatform: InstallPlatform;
  onBack: () => void;
  onIssueWorkerInstallToken: () => void | Promise<void>;
};

export function WorkerPairingPage({
  workerInstallCommands,
  workerInstallError,
  isIssuingWorkerInstallToken,
  defaultInstallPlatform,
  onBack,
  onIssueWorkerInstallToken,
}: WorkerPairingPageProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<InstallPlatform>(
    defaultInstallPlatform,
  );

  useEffect(() => {
    if (
      defaultInstallPlatform === "windows" &&
      workerInstallCommands?.windowsCommand
    ) {
      setSelectedPlatform("windows");
      return;
    }

    setSelectedPlatform("unix");
  }, [defaultInstallPlatform, workerInstallCommands]);

  const selectedCommand = useMemo(() => {
    if (!workerInstallCommands) {
      return null;
    }

    return selectedPlatform === "windows"
      ? workerInstallCommands.windowsCommand
      : workerInstallCommands.unixCommand;
  }, [selectedPlatform, workerInstallCommands]);

  const hasWindowsCommand = Boolean(workerInstallCommands?.windowsCommand);

  return (
    <PageShell
      title="安装 Worker"
      subtitle="仍然只保留一种安装方式：生成命令，然后按你的电脑平台复制对应 one-liner。"
      onBack={onBack}
      backLabel="back to settings"
    >
      <div className="space-y-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-[#181818] p-4 text-cyan-400">
                <Fingerprint size={24} />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    一键安装
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    只保留一种安装方式：生成命令，复制到电脑终端执行。macOS /
                    Linux 会安装并启动 systemd --user Worker service；macOS
                    会安装并启动 launchd Worker agent；Windows 会通过 NSSM
                    安装并启动 Worker Windows Service。
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    void onIssueWorkerInstallToken();
                  }}
                  disabled={isIssuingWorkerInstallToken}
                  className="w-full"
                >
                  {isIssuingWorkerInstallToken
                    ? "生成中..."
                    : workerInstallCommands
                      ? "重新生成安装命令"
                      : "生成安装命令"}
                </Button>

                {workerInstallError && (
                  <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                    {workerInstallError}
                  </div>
                )}

                {selectedCommand && (
                  <div className="space-y-2 rounded-2xl border border-[#24313a] bg-[#0d1519] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                        一键安装命令
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                            selectedPlatform === "unix"
                              ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                              : "border-[#24313a] bg-[#111315] text-gray-400"
                          }`}
                          onClick={() => setSelectedPlatform("unix")}
                        >
                          <MonitorSmartphone size={12} />
                          macOS / Linux
                        </button>
                        <button
                          type="button"
                          disabled={!hasWindowsCommand}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                            selectedPlatform === "windows"
                              ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-100"
                              : "border-[#24313a] bg-[#111315] text-gray-400"
                          } ${!hasWindowsCommand ? "cursor-not-allowed opacity-50" : ""}`}
                          onClick={() => setSelectedPlatform("windows")}
                        >
                          <Fingerprint size={12} />
                          Windows
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] leading-5 text-gray-400">
                      {selectedPlatform === "windows"
                        ? "在 Windows Terminal、PowerShell 或 CMD 执行下面这一行。脚本会自动下载 Worker、写默认配置，并通过 NSSM 注册和启动 Windows Service。"
                        : "在 macOS / Linux 终端执行下面这一行。脚本会自动下载 Worker、写默认配置，并注册为受管服务：Linux 使用 systemd --user，macOS 使用 launchd。"}
                    </div>
                    <pre className="overflow-x-auto rounded-xl bg-[#111315] px-3 py-3 font-mono text-[11px] text-cyan-200 whitespace-pre-wrap break-all">
                      {selectedCommand}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
