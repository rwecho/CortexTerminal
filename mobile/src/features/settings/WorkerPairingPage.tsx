import { Fingerprint } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

type WorkerPairingPageProps = {
  workerRegistrationKey: string | null;
  workerRegistrationKeyIssuedAtUtc: string | null;
  workerRegistrationKeyError: string | null;
  isIssuingWorkerRegistrationKey: boolean;
  onBack: () => void;
  onIssueWorkerRegistrationKey: () => void | Promise<void>;
};

export function WorkerPairingPage({
  workerRegistrationKey,
  workerRegistrationKeyIssuedAtUtc,
  workerRegistrationKeyError,
  isIssuingWorkerRegistrationKey,
  onBack,
  onIssueWorkerRegistrationKey,
}: WorkerPairingPageProps) {
  return (
    <PageShell
      title="Worker Runner Auth"
      subtitle="仅保留 runner auth model：为当前用户生成 worker registration key，并通过 WORKER_USER_KEY 启动节点。"
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
                    Worker registration key
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    将该 key 配置到 worker 的 <code>WORKER_USER_KEY</code>{" "}
                    后，节点启动时即可自动换取 access token 并重新注册上线。
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    void onIssueWorkerRegistrationKey();
                  }}
                  disabled={isIssuingWorkerRegistrationKey}
                  className="w-full"
                >
                  {isIssuingWorkerRegistrationKey
                    ? "生成中..."
                    : workerRegistrationKey
                      ? "重新生成 Worker Key"
                      : "生成 Worker Key"}
                </Button>

                {workerRegistrationKey && (
                  <div className="space-y-2 rounded-2xl border border-[#24313a] bg-[#111315] p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                      WORKER_USER_KEY
                    </div>
                    <div className="break-all font-mono text-sm text-emerald-200">
                      {workerRegistrationKey}
                    </div>
                    {workerRegistrationKeyIssuedAtUtc && (
                      <div className="text-[11px] text-gray-500">
                        Issued at{" "}
                        {new Date(
                          workerRegistrationKeyIssuedAtUtc,
                        ).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {workerRegistrationKeyError && (
                  <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                    {workerRegistrationKeyError}
                  </div>
                )}
                <div className="rounded-2xl border border-[#24313a] bg-[#0d1519] px-3 py-3 text-[11px] leading-5 text-gray-400">
                  建议在 worker 的启动环境中设置：<code>WORKER_USER_KEY</code>、
                  <code>WORKER_ID</code>、<code>WORKER_DISPLAY_NAME</code>。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
