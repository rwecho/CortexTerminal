export type PendingAttachment = {
  id: string;
  kind: "file" | "audio";
  displayName: string;
  fileName: string;
  mimeType: string;
  size: number;
  base64: string;
  durationMs?: number;
  source: "native" | "browser";
};

export function formatAttachmentSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAttachmentDuration(durationMs?: number): string | null {
  if (!durationMs || durationMs <= 0) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
