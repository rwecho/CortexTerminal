import type { PendingAttachment } from "./terminalAttachmentTypes";

const relayControlPrefix = "__ct_ctl__:";
const textEncoder = new TextEncoder();

type RelayAttachmentCommandFrame = {
  kind: "attachment-command";
  command: string;
  attachments: Array<{
    attachmentId: string;
    kind: PendingAttachment["kind"];
    fileName: string;
    mimeType: string;
    size: number;
    base64: string;
    durationMs?: number;
  }>;
};

type RelayTerminalResizeFrame = {
  kind: "terminal-resize";
  cols: number;
  rows: number;
};

export function buildAttachmentCommandPayload(
  command: string,
  attachments: PendingAttachment[],
): Uint8Array {
  const frame: RelayAttachmentCommandFrame = {
    kind: "attachment-command",
    command,
    attachments: attachments.map((attachment) => ({
      attachmentId: attachment.id,
      kind: attachment.kind,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      base64: attachment.base64,
      durationMs: attachment.durationMs,
    })),
  };

  return textEncoder.encode(`${relayControlPrefix}${JSON.stringify(frame)}`);
}

export function buildDoctorCommandPayload(): Uint8Array {
  return textEncoder.encode(
    `${relayControlPrefix}${JSON.stringify({ kind: "doctor-command" })}`,
  );
}

export function buildTerminalResizePayload(
  cols: number,
  rows: number,
): Uint8Array {
  const frame: RelayTerminalResizeFrame = {
    kind: "terminal-resize",
    cols,
    rows,
  };

  return textEncoder.encode(`${relayControlPrefix}${JSON.stringify(frame)}`);
}
