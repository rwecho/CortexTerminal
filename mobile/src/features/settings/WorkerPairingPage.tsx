import { Fingerprint } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

type WorkerPairingPageProps = {
  workerInstallToken: string | null;
  workerInstallCommand: string | null;
  workerInstallUrl: string | null;
  workerInstallIssuedAtUtc: string | null;
  workerInstallExpiresAtUtc: string | null;
  workerInstallError: string | null;
  isIssuingWorkerInstallToken: boolean;
  onBack: () => void;
  onIssueWorkerInstallToken: () => void | Promise<void>;
};

export function WorkerPairingPage({
  workerInstallToken,
  workerInstallCommand,
  workerInstallUrl,
  workerInstallIssuedAtUtc,
  workerInstallExpiresAtUtc,
  workerInstallError,
  isIssuingWorkerInstallToken,
  onBack,
  onIssueWorkerInstallToken,
}: WorkerPairingPageProps) {
  return (
    <PageShell
      title="创建 Worker"
      subtitle="生成短期 install token，然后在电脑上执行一条命令完成安装与首次启动。"
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
                    Worker Install Token
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    生成一次性短 token。电脑端执行命令后，gateway
                    会自动签发真正的 worker registration key。
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

                {workerInstallToken && (
                  <div className="space-y-2 rounded-2xl border border-[#24313a] bg-[#111315] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                      INSTALL TOKEN
                    </div>
                    <div className="break-all font-mono text-sm text-emerald-200">
                      {workerInstallToken}
                    </div>
                    <div className="space-y-1 text-[11px] text-gray-500">
                      {workerInstallIssuedAtUtc && (
                        <div>
                          生成时间{" "}
                          {new Date(workerInstallIssuedAtUtc).toLocaleString()}
                        </div>
                      )}
                      {workerInstallExpiresAtUtc && (
                        <div>
                          过期时间{" "}
                          {new Date(workerInstallExpiresAtUtc).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                      worker、写默认配置、换取 registration key，并直接启动首个
                      worker 进程。
                    </div>
                    <pre className="overflow-x-auto rounded-xl bg-[#111315] px-3 py-3 font-mono text-[11px] text-cyan-200 whitespace-pre-wrap break-all">
                      {workerInstallCommand}
                    </pre>
                    {workerInstallUrl && (
                      <div className="text-[11px] leading-5 text-gray-500 break-all">
                        install url: {workerInstallUrl}
                      </div>
                    )}
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
