import { AlertTriangle, LoaderCircle, RotateCcw, WifiOff } from "lucide-react";
import type { TerminalRecoverySnapshot } from "./terminalRecovery";

type TerminalRecoveryBannerProps = {
  snapshot: TerminalRecoverySnapshot;
  onRetry?: () => void | Promise<void>;
};

export function TerminalRecoveryBanner({
  snapshot,
  onRetry,
}: TerminalRecoveryBannerProps) {
  const icon =
    snapshot.phase === "worker-offline" ? (
      <WifiOff size={16} className="shrink-0" />
    ) : snapshot.phase === "reconnecting" ||
      snapshot.phase === "reattaching" ||
      snapshot.phase === "booting" ? (
      <LoaderCircle size={16} className="shrink-0 animate-spin" />
    ) : (
      <AlertTriangle size={16} className="shrink-0" />
    );

  const toneClassName =
    snapshot.tone === "danger"
      ? "border-red-900/60 bg-red-950/40 text-red-100"
      : snapshot.tone === "warning"
        ? "border-amber-900/60 bg-amber-950/30 text-amber-100"
        : "border-cyan-900/60 bg-cyan-950/20 text-cyan-100";

  return (
    <div
      className={`mb-2 flex items-start justify-between gap-3 rounded-2xl border px-3 py-2 text-sm ${toneClassName}`}
    >
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <div className="font-semibold">{snapshot.title}</div>
          <div className="mt-0.5 text-xs opacity-90">
            {snapshot.description}
          </div>
        </div>
      </div>

      {snapshot.showRetry && onRetry ? (
        <button
          type="button"
          onClick={() => {
            void onRetry();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-black/20 px-2.5 py-1.5 text-[11px] font-medium text-white/90"
        >
          <RotateCcw size={12} />
          重试
        </button>
      ) : null}
    </div>
  );
}
