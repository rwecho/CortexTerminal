import { FileText, Mic, X } from "lucide-react";
import {
  formatAttachmentDuration,
  formatAttachmentSize,
  type PendingAttachment,
} from "./terminalAttachmentTypes";

type PendingAttachmentListProps = {
  attachments: PendingAttachment[];
  onRemove: (attachmentId: string) => void | Promise<void>;
};

export function PendingAttachmentList({
  attachments,
  onRemove,
}: PendingAttachmentListProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto mb-2 flex max-w-4xl flex-wrap gap-2">
      {attachments.map((attachment) => {
        const durationLabel = formatAttachmentDuration(attachment.durationMs);

        return (
          <div
            key={attachment.id}
            className="flex items-center gap-2 rounded-2xl border border-[#223038] bg-[#0a1114] px-3 py-2 text-xs text-gray-300"
          >
            <span className="text-cyan-400">
              {attachment.kind === "audio" ? (
                <Mic size={14} />
              ) : (
                <FileText size={14} />
              )}
            </span>

            <div className="min-w-0">
              <div className="max-w-48 truncate font-medium text-gray-100">
                {attachment.displayName}
              </div>
              <div className="text-[10px] text-gray-500">
                {formatAttachmentSize(attachment.size)} · {attachment.source}
                {durationLabel ? ` · ${durationLabel}` : ""}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                void onRemove(attachment.id);
              }}
              className="rounded-full p-1 text-gray-500 transition-colors hover:bg-[#162028] hover:text-gray-200"
              aria-label={`remove ${attachment.displayName}`}
              title="remove attachment"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
