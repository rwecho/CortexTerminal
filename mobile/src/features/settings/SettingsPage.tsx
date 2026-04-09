import { useEffect, useState } from "react";
import {
  Fingerprint,
  Info,
  LogOut,
  ScrollText,
  ShieldCheck,
  User,
} from "lucide-react";
import type { GatewayPrincipal } from "../../lib/gatewayAuthClient";
import { getAppVersionLabel } from "../app/config";
import {
  formatStartupVersionLabel,
  getStartupConfig,
  isNativeStartupFallback,
  refreshStartupConfig,
} from "../native/startup/nativeStartup";
import { PageShell } from "../../components/layout/PageShell";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

type SettingsPageProps = {
  currentPrincipal: GatewayPrincipal | null;
  onOpenPairWorker: () => void;
  onOpenAudit: () => void;
  onSignOut: () => void | Promise<void>;
};

export function SettingsPage({
  currentPrincipal,
  onOpenPairWorker,
  onOpenAudit,
  onSignOut,
}: SettingsPageProps) {
  const [versionLabel, setVersionLabel] = useState(() => getAppVersionLabel());
  const [versionHint, setVersionHint] = useState<string | null>(() =>
    isNativeStartupFallback(getStartupConfig())
      ? "当前未收到 native startup config。"
      : null,
  );

  useEffect(() => {
    let isCancelled = false;

    void refreshStartupConfig().then((config) => {
      if (isCancelled) {
        return;
      }

      setVersionLabel(formatStartupVersionLabel(config));
      setVersionHint(
        isNativeStartupFallback(config)
          ? "当前未收到 native startup config。"
          : null,
      );
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <PageShell title="设置" subtitle="账户与节点管理。">
      <div className="space-y-5">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-[#181818] p-4 text-cyan-400">
                <User size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-white">
                  {currentPrincipal?.displayName ??
                    currentPrincipal?.username ??
                    "Unknown user"}
                </div>
                <div className="mt-1 break-all text-sm text-gray-400">
                  {currentPrincipal?.email ?? "No email configured"}
                </div>
                <div className="mt-3 text-[12px] text-gray-500">
                  当前账号已登录，可直接管理 Worker 与审计记录。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#181818] p-3 text-cyan-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  Worker 节点
                </div>
                <div className="text-[11px] text-gray-500">
                  生成一条安装命令，在电脑上一键接入 Worker。
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={onOpenPairWorker}
              className="w-full justify-start"
            >
              <Fingerprint size={18} className="text-cyan-400" />
              安装 Worker
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={onOpenAudit}
              className="w-full justify-start"
            >
              <ScrollText size={18} className="text-cyan-400" />
              查看审计
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#181818] p-3 text-cyan-400">
                <Info size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">版本信息</div>
                <div className="mt-1 text-[12px] text-gray-400">
                  当前 App 版本：{versionLabel}
                </div>
                {versionHint ? (
                  <div className="mt-1 text-[11px] text-amber-300/80">
                    {versionHint}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="button"
          onClick={() => {
            void onSignOut();
          }}
          variant="danger"
          className="w-full"
        >
          <LogOut size={16} /> 退出登录
        </Button>
      </div>
    </PageShell>
  );
}
