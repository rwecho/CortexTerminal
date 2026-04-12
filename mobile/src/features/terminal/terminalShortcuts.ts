import type { AgentFamily } from "../app/appTypes";

export type TerminalShortcut = {
  id: string;
  label: string;
  description: string;
  sendText: string;
  displayText: string;
};

function createShortcut(
  id: string,
  label: string,
  description: string,
  sendText: string,
  displayText = label,
): TerminalShortcut {
  return {
    id,
    label,
    description,
    sendText,
    displayText,
  };
}

export function buildRuntimeShortcuts(
  agentFamily: AgentFamily,
): TerminalShortcut[] {
  switch (agentFamily) {
    case "claude":
      return [
        createShortcut("claude-esc", "Esc", "取消当前交互", "\u001b", "<Esc>"),
        createShortcut(
          "claude-shift-tab",
          "Shift+Tab",
          "回到上一个交互焦点",
          "\u001b[Z",
          "<Shift+Tab>",
        ),
        createShortcut("claude-enter", "Enter", "继续当前流程", "\n", "<Enter>"),
      ];
    case "codex":
      return [
        createShortcut("codex-esc", "Esc", "退出当前提示层", "\u001b", "<Esc>"),
        createShortcut(
          "codex-shift-tab",
          "Shift+Tab",
          "反向切换当前选项",
          "\u001b[Z",
          "<Shift+Tab>",
        ),
        createShortcut("codex-enter", "Enter", "确认当前选择", "\n", "<Enter>"),
      ];
    case "opencode":
      return [
        createShortcut("opencode-esc", "Esc", "取消当前交互", "\u001b", "<Esc>"),
        createShortcut(
          "opencode-shift-tab",
          "Shift+Tab",
          "反向切换候选项",
          "\u001b[Z",
          "<Shift+Tab>",
        ),
        createShortcut("opencode-enter", "Enter", "确认当前步骤", "\n", "<Enter>"),
      ];
    case "copilot":
      return [
        createShortcut("copilot-esc", "Esc", "取消当前建议", "\u001b", "<Esc>"),
        createShortcut("copilot-tab", "Tab", "接受当前建议", "\t", "<Tab>"),
        createShortcut("copilot-enter", "Enter", "提交当前输入", "\n", "<Enter>"),
      ];
    case "gemini":
      return [
        createShortcut("gemini-esc", "Esc", "取消当前交互", "\u001b", "<Esc>"),
        createShortcut("gemini-enter", "Enter", "继续当前对话", "\n", "<Enter>"),
      ];
  }
}
