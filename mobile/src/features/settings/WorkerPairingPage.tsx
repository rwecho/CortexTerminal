import { Fingerprint } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

type WorkerPairingPageProps = {
  workerPairingCode: string;
  workerPairingError: string | null;
  workerPairingMessage: string | null;
  isApprovingWorkerPairing: boolean;
  onBack: () => void;
  onWorkerPairingCodeChange: (value: string) => void;
  onApprove: () => void | Promise<void>;
};

export function WorkerPairingPage({
  workerPairingCode,
  workerPairingError,
  workerPairingMessage,
  isApprovingWorkerPairing,
  onBack,
  onWorkerPairingCodeChange,
  onApprove,
}: WorkerPairingPageProps) {
  return (
    <PageShell
      title="配对 Worker Device"
      subtitle="在 worker 控制台拿到 pairing code 后，在这里完成授权。"
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
              <div className="flex-1 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-white">
                    Device authorization
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    该流程只负责节点授权，不与会话操作混用。
                  </div>
                </div>

                <Input
                  type="text"
                  value={workerPairingCode}
                  onChange={(event) =>
                    onWorkerPairingCodeChange(event.target.value.toUpperCase())
                  }
                  placeholder="ABCD-EFGH"
                  className="font-mono uppercase tracking-[0.2em] placeholder:tracking-normal"
                />

                <Button
                  type="button"
                  onClick={() => {
                    void onApprove();
                  }}
                  disabled={
                    isApprovingWorkerPairing ||
                    workerPairingCode.trim().length === 0
                  }
                  className="w-full"
                >
                  {isApprovingWorkerPairing ? "授权中..." : "授权节点"}
                </Button>
              </div>
            </div>

            {workerPairingError && (
              <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
                {workerPairingError}
              </div>
            )}

            {workerPairingMessage && (
              <div className="mt-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-200">
                {workerPairingMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
