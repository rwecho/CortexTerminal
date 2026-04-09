import { Fingerprint } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

type WorkerPairingPageProps = {
  workerInstallCommand: string | null;
  workerInstallError: string | null;
  isIssuingWorkerInstallToken: boolean;
  onBack: () => void;
  onIssueWorkerInstallToken: () => void | Promise<void>;
};

export function WorkerPairingPage({
  workerInstallCommand,
  workerInstallError,
  isIssuingWorkerInstallToken,
  onBack,
  onIssueWorkerInstallToken,
}: WorkerPairingPageProps) {
  return (
    <PageShell
      title="安装 Worker"
      subtitle="收敛为一种接入方式：生成一条安装命令，然后在电脑上执行。"
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
                    只保留一种安装方式：生成命令，复制到电脑终端执行，系统会自动完成安装、默认配置与首次启动。
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
                    : workerInstallCommand
                      ? "重新生成安装命令"
                      : "生成安装命令"}
                </Button>

                {workerInstallError && (
                  <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                    {workerInstallError}
                  </div>
                )}

                {workerInstallCommand && (
                  <div className="space-y-2 rounded-2xl border border-[#24313a] bg-[#0d1519] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                      一键安装命令
                    </div>
                    <div className="text-[11px] leading-5 text-gray-400">
                      在电脑终端执行下面这一行。脚本会自动下载
                      Worker、写默认配置并直接启动首个 Worker 进程。
                    </div>
                    <pre className="overflow-x-auto rounded-xl bg-[#111315] px-3 py-3 font-mono text-[11px] text-cyan-200 whitespace-pre-wrap break-all">
                      {workerInstallCommand}
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
