export type TerminalInteractionAction = {
  id: string;
  label: string;
  sendText?: string;
  displayText?: string;
  variant: "primary" | "secondary" | "ghost" | "danger";
  kind: "send" | "focus-input";
};

export type TerminalInteraction = {
  signature: string;
  title: string;
  prompt: string;
  rawBlock: string;
  confidence: "high" | "medium";
  allowFreeformInput: boolean;
  actions: TerminalInteractionAction[];
  indicators: string[];
};

const ansiPattern =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI stripping requires control ranges.
  /\u001b\[[0-?]*[ -/]*[@-~]|\u001b[@-_]|\u009b[0-?]*[ -/]*[@-~]/g;
const horizontalRulePattern = /^[\s\-─━═_·•]{8,}$/;
const promptLinePattern =
  /(do you want to proceed|confirm|choose|select|pick|continue\?|approve|allow|permission|what should .* do|type here|enter to|press enter|press any key|y\/n|yes\/no)/i;
const escCancelPattern =
  /(esc(?:ape)?\s+to\s+cancel|press\s+esc\s+to\s+cancel)/i;
const enterContinuePattern =
  /(press\s+enter\s+to\s+(continue|confirm)|enter\s+to\s+(continue|confirm))/i;
const yesNoInlinePattern = /\[\s*(y\/n|Y\/n|y\/N|Y\/N|yes\/no)\s*\]/;
const freeformOptionPattern =
  /(type here|tell .* what to do differently|describe what to do differently|other instructions|custom response)/i;
const cancelOptionPattern = /\bcancel\b|\babort\b|\bdeny\b|\bno\b/i;
const affirmativeOptionPattern =
  /\byes\b|\ballow\b|\bapprove\b|\bcontinue\b|\bok\b|\bproceed\b/i;

function stripAnsi(value: string): string {
  return value.replace(ansiPattern, "");
}

function normalizeTranscript(transcript: string): string {
  return stripAnsi(transcript)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\t/g, "  ");
}

function trimTranscript(transcript: string, maxLength = 16000): string {
  if (transcript.length <= maxLength) {
    return transcript;
  }

  return transcript.slice(transcript.length - maxLength);
}

function normalizeLine(line: string): string {
  return line.replace(/\s+$/g, "");
}

function isHorizontalRule(line: string): boolean {
  return horizontalRulePattern.test(line.trim());
}

function findCandidateBlock(lines: string[]): string[] {
  const searchStart = Math.max(0, lines.length - 40);
  const trailingLines = lines.slice(searchStart);

  let endIndex = trailingLines.length - 1;
  while (endIndex >= 0 && trailingLines[endIndex].trim().length === 0) {
    endIndex -= 1;
  }

  if (endIndex < 0) {
    return [];
  }

  let startIndex = Math.max(0, endIndex - 16);

  for (let i = endIndex; i >= 0; i -= 1) {
    const line = trailingLines[i];
    if (isHorizontalRule(line)) {
      startIndex = i;
      break;
    }

    if (line.trim().length === 0 && i < endIndex - 2) {
      startIndex = i + 1;
      break;
    }
  }

  return trailingLines.slice(startIndex, endIndex + 1);
}

type ParsedNumberedOption = {
  index: string;
  label: string;
};

function parseNumberedOptions(lines: string[]): ParsedNumberedOption[] {
  const options: ParsedNumberedOption[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const optionMatch = line.match(/^\s*(?:[>›❯]\s*)?(\d+)[.)]\s+(.+)$/);
    if (!optionMatch) {
      continue;
    }

    const [, optionIndex, firstLabelSegment] = optionMatch;
    const labelSegments = [firstLabelSegment.trim()];

    let nextIndex = index + 1;
    while (nextIndex < lines.length) {
      const nextLine = lines[nextIndex];
      const trimmed = nextLine.trim();
      const beginsAnotherOption = /^\s*(?:[>›❯]\s*)?\d+[.)]\s+/.test(nextLine);
      if (
        trimmed.length === 0 ||
        beginsAnotherOption ||
        isHorizontalRule(nextLine)
      ) {
        break;
      }

      if (/^\s{2,}\S/.test(nextLine)) {
        labelSegments.push(trimmed);
        nextIndex += 1;
        continue;
      }

      break;
    }

    index = nextIndex - 1;
    options.push({
      index: optionIndex,
      label: labelSegments.join(" "),
    });
  }

  return options;
}

function buildNumberedActions(options: ParsedNumberedOption[]): {
  actions: TerminalInteractionAction[];
  allowFreeformInput: boolean;
} {
  const actions: TerminalInteractionAction[] = [];
  let allowFreeformInput = false;

  for (const option of options) {
    const label = option.label.replace(/^[-:]+\s*/, "").trim();
    if (freeformOptionPattern.test(label)) {
      allowFreeformInput = true;
      actions.push({
        id: `focus-${option.index}`,
        label: "输入自定义回复",
        displayText: label,
        kind: "focus-input",
        variant: "ghost",
      });
      continue;
    }

    const variant = cancelOptionPattern.test(label)
      ? "danger"
      : affirmativeOptionPattern.test(label)
        ? "primary"
        : "secondary";

    actions.push({
      id: `send-${option.index}`,
      label,
      sendText: option.index,
      displayText: `${option.index}. ${label}`,
      kind: "send",
      variant,
    });
  }

  return { actions, allowFreeformInput };
}

function appendCancelAction(
  actions: TerminalInteractionAction[],
): TerminalInteractionAction[] {
  if (actions.some((action) => action.sendText === "\u001b")) {
    return actions;
  }

  return [
    ...actions,
    {
      id: "cancel-escape",
      label: "Esc 取消",
      sendText: "\u001b",
      displayText: "<Esc>",
      kind: "send",
      variant: "danger",
    },
  ];
}

function buildYesNoActions(line: string): TerminalInteractionAction[] {
  const normalized = line.toLowerCase();
  const actions: TerminalInteractionAction[] = [];

  if (normalized.includes("y/n") || normalized.includes("yes/no")) {
    actions.push(
      {
        id: "yes",
        label: "Yes",
        sendText: "y",
        displayText: "y",
        kind: "send",
        variant: "primary",
      },
      {
        id: "no",
        label: "No",
        sendText: "n",
        displayText: "n",
        kind: "send",
        variant: "danger",
      },
    );
  }

  return actions;
}

function inferPromptLine(
  lines: string[],
  options: ParsedNumberedOption[],
): string {
  if (options.length > 0) {
    const firstOptionIndex = lines.findIndex((line) =>
      /^\s*(?:[>›❯]\s*)?\d+[.)]\s+/.test(line),
    );

    for (let index = firstOptionIndex - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line) {
        continue;
      }

      if (isHorizontalRule(line)) {
        continue;
      }

      return line;
    }
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (line && promptLinePattern.test(line)) {
      return line;
    }
  }

  return lines.at(-1)?.trim() ?? "Terminal requires input";
}

function buildSignature(
  block: string,
  actions: TerminalInteractionAction[],
): string {
  return `${block}::${actions.map((action) => action.id).join("|")}`;
}

export function appendTerminalTranscript(
  currentTranscript: string,
  nextText: string,
): string {
  return trimTranscript(`${currentTranscript}${normalizeTranscript(nextText)}`);
}

export function detectTerminalInteraction(
  transcript: string,
): TerminalInteraction | null {
  const normalizedTranscript = normalizeTranscript(transcript);
  if (!normalizedTranscript.trim()) {
    return null;
  }

  const lines = normalizedTranscript.split("\n").map(normalizeLine);
  const candidateBlockLines = findCandidateBlock(lines);
  if (candidateBlockLines.length === 0) {
    return null;
  }

  const rawBlock = candidateBlockLines.join("\n").trim();
  if (!rawBlock) {
    return null;
  }

  const indicators: string[] = [];
  const numberedOptions = parseNumberedOptions(candidateBlockLines);
  const promptLine = inferPromptLine(candidateBlockLines, numberedOptions);
  const hasEscCancel = candidateBlockLines.some((line) =>
    escCancelPattern.test(line),
  );
  const hasHorizontalRule = candidateBlockLines.some(isHorizontalRule);
  const inlineYesNoLine = candidateBlockLines.find((line) =>
    yesNoInlinePattern.test(line),
  );
  const hasEnterContinue = candidateBlockLines.some((line) =>
    enterContinuePattern.test(line),
  );

  if (hasEscCancel) {
    indicators.push("esc-cancel");
  }

  if (hasHorizontalRule) {
    indicators.push("horizontal-rule");
  }

  if (numberedOptions.length > 0) {
    indicators.push("numbered-options");
  }

  if (inlineYesNoLine) {
    indicators.push("yes-no");
  }

  if (hasEnterContinue) {
    indicators.push("enter-continue");
  }

  if (promptLinePattern.test(promptLine)) {
    indicators.push("prompt-language");
  }

  let actions: TerminalInteractionAction[] = [];
  let allowFreeformInput = false;

  if (numberedOptions.length > 0) {
    const numberedResult = buildNumberedActions(numberedOptions);
    actions = numberedResult.actions;
    allowFreeformInput = numberedResult.allowFreeformInput;
  } else if (inlineYesNoLine) {
    actions = buildYesNoActions(inlineYesNoLine);
  }

  if (hasEnterContinue) {
    actions.push({
      id: "send-enter",
      label: "Enter 继续",
      sendText: "\n",
      displayText: "<Enter>",
      kind: "send",
      variant: "primary",
    });
  }

  if (hasEscCancel) {
    actions = appendCancelAction(actions);
  }

  const score =
    (hasHorizontalRule ? 2 : 0) +
    (hasEscCancel ? 2 : 0) +
    (numberedOptions.length > 0 ? 2 : 0) +
    (inlineYesNoLine ? 2 : 0) +
    (hasEnterContinue ? 1 : 0) +
    (promptLinePattern.test(promptLine) ? 1 : 0);

  const isLikelyInteraction =
    actions.length > 0 &&
    ((hasEscCancel && (numberedOptions.length > 0 || hasEnterContinue)) ||
      score >= 4);

  if (!isLikelyInteraction) {
    return null;
  }

  return {
    signature: buildSignature(rawBlock, actions),
    title: "Terminal requires user input",
    prompt: promptLine,
    rawBlock,
    confidence: score >= 6 ? "high" : "medium",
    allowFreeformInput,
    actions,
    indicators,
  };
}
