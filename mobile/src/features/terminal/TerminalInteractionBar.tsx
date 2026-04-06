import type {
  TerminalInteraction,
  TerminalInteractionAction,
} from "./interactionDetector";

function getActionClassName(action: TerminalInteractionAction): string {
  switch (action.variant) {
    case "primary":
      return "border-cyan-700/40 bg-cyan-600/20 text-cyan-100 hover:bg-cyan-600/30";
    case "danger":
      return "border-red-800/40 bg-red-950/30 text-red-200 hover:bg-red-950/45";
    case "secondary":
      return "border-[#24313a] bg-[#11191d] text-gray-100 hover:bg-[#162126]";
    case "ghost":
    default:
      return "border-[#223038] bg-transparent text-gray-300 hover:bg-[#11191d]";
  }
}

type TerminalInteractionBarProps = {
  interaction: TerminalInteraction;
  onAction: (action: TerminalInteractionAction) => void;
};

export function TerminalInteractionBar({
  interaction,
  onAction,
}: TerminalInteractionBarProps) {
  return (
    <div className="mb-2 rounded-2xl border border-[#1f2a30] bg-[#0a1114] px-3 py-3 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-cyan-900/40 bg-cyan-950/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              {interaction.confidence === "high"
                ? "Interactive Prompt"
                : "Likely Prompt"}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-gray-600">
              {interaction.indicators.join(" · ")}
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            {interaction.prompt}
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-gray-400">
            识别到终端正在等待用户输入。按钮只会把你的选择原样写回当前
            PTY，不会替你做额外决定。
          </div>
          {interaction.allowFreeformInput && (
            <div className="mt-2 text-[11px] text-cyan-300">
              如需自己输入，请先点击“输入自定义回复”，再展开专用输入区。
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {interaction.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${getActionClassName(action)}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
