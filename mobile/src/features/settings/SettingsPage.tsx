import {
  Fingerprint,
  LogOut,
  ScrollText,
  ShieldCheck,
  User,
} from "lucide-react";
import type { GatewayPrincipal } from "../../lib/gatewayAuthClient";
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
  return (
    <PageShell title="设置" subtitle="账户、安全、节点授权与审计入口统一收口。">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#24313a] bg-[#0d1519] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                    subject · {currentPrincipal?.subject ?? "n/a"}
                  </span>
                  {currentPrincipal?.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full border border-[#24313a] bg-[#0d1519] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-gray-400"
                    >
                      {scope}
                    </span>
                  ))}
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
                <div className="text-sm font-semibold text-white">节点授权</div>
                <div className="text-[11px] text-gray-500">
                  管理 runner-style worker registration key。
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
              Worker Runner Auth
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={onOpenAudit}
              className="w-full justify-start"
            >
              <ScrollText size={18} className="text-cyan-400" />
              查看审计记录
            </Button>
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
