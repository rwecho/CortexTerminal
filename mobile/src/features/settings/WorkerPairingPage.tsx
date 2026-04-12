import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Fingerprint, MonitorSmartphone } from "lucide-react";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import type { WorkerInstallCommandSet } from "../../lib/gatewayAuthClient";
import { copyNativeText, showNativeToast } from "../native/bridge/nativeBridge";

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
  const hasIssuedCommandOnEntry = useRef(false);
  const [selectedPlatform, setSelectedPlatform] = useState<InstallPlatform>(
    defaultInstallPlatform,
  );
  const [copiedPlatform, setCopiedPlatform] = useState<InstallPlatform | null>(
    null,
  );

  useEffect(() => {
    if (hasIssuedCommandOnEntry.current || isIssuingWorkerInstallToken) {
      return;
    }

    hasIssuedCommandOnEntry.current = true;
    void onIssueWorkerInstallToken();
  }, [isIssuingWorkerInstallToken, onIssueWorkerInstallToken]);

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

  useEffect(() => {
    if (!copiedPlatform) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedPlatform(null);
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [copiedPlatform]);

  const handleCopyCommand = async () => {
    if (!selectedCommand) {
      return;
    }

    await copyNativeText(selectedCommand);
    setCopiedPlatform(selectedPlatform);
    await showNativeToast("安装命令已复制");
  };

  return (
    <PageShell
      title="安装 Worker"
      subtitle="复制命令到目标电脑并执行一次。"
      onBack={onBack}
      backLabel="back to settings"
    >
      <div className="space-y-5">
        <Card>
          <CardContent className="p-5">
            <div className="min-w-0 space-y-4">
              {workerInstallError && (
                <div className="space-y-3 rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-3 text-sm text-red-200">
                  <div>{workerInstallError}</div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void onIssueWorkerInstallToken();
                    }}
                    disabled={isIssuingWorkerInstallToken}
                  >
                    {isIssuingWorkerInstallToken ? "重试中..." : "重试"}
                  </Button>
                </div>
              )}

              {!selectedCommand && !workerInstallError && (
                <div className="rounded-2xl border border-[#24313a] bg-[#0d1519] px-3 py-4 text-sm text-gray-400">
                  {isIssuingWorkerInstallToken
                    ? "正在获取安装命令..."
                    : "等待安装命令..."}
                </div>
              )}

              {selectedCommand && (
                <div className="space-y-2 rounded-2xl border border-[#24313a] bg-[#0d1519] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-gray-500">
                      点击命令可直接复制
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={
                        copiedPlatform === selectedPlatform
                          ? "default"
                          : "secondary"
                      }
                      size="sm"
                      onClick={() => {
                        void handleCopyCommand();
                      }}
                    >
                      {copiedPlatform === selectedPlatform ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedPlatform === selectedPlatform ? "已复制" : "复制"}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyCommand();
                    }}
                    className="block w-full rounded-xl bg-[#111315] px-3 py-3 text-left transition hover:bg-[#151a1d]"
                  >
                    <pre className="overflow-x-auto font-mono text-[11px] text-cyan-200 whitespace-pre-wrap break-all">
                      {selectedCommand}
                    </pre>
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
