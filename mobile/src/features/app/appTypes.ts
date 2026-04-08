import type { LucideIcon } from "lucide-react";

export type View =
  | "home"
  | "newSession"
  | "terminal"
  | "audit"
  | "settings"
  | "workerAuth";

export type LogItem = {
  type: "system" | "command" | "ai";
  text: string;
};

export type StatusItem = {
  label: string;
  icon: LucideIcon;
};

export type AgentFamily = "claude" | "codex" | "gemini" | "opencode";

export type AgentOption = {
  id: AgentFamily;
  label: string;
  description: string;
};
