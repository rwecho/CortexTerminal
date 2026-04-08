using System.Text;
using System.Text.Json;

namespace CortexTerminal.Gateway.Services.Relay;

public static class RelayControlFrameAuditExtractor
{
    private const string RelayControlPrefix = "__ct_ctl__:";

    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web);

    public static bool TryExtractAuditedCommand(string encryptedFrameBase64, out RelayAuditedCommand? auditedCommand)
    {
        auditedCommand = null;

        string payloadText;
        try
        {
            payloadText = Encoding.UTF8.GetString(Convert.FromBase64String(encryptedFrameBase64)).Trim();
        }
        catch
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(payloadText)
            || payloadText.StartsWith("__ct_", StringComparison.Ordinal) && !payloadText.StartsWith(RelayControlPrefix, StringComparison.Ordinal)
            || string.Equals(payloadText, "\u001b", StringComparison.Ordinal)
            || string.Equals(payloadText, "\n", StringComparison.Ordinal))
        {
            return false;
        }

        if (!payloadText.StartsWith(RelayControlPrefix, StringComparison.Ordinal))
        {
            auditedCommand = new RelayAuditedCommand(payloadText, Array.Empty<string>());
            return true;
        }

        try
        {
            var controlFrame = JsonSerializer.Deserialize<RelayControlCommandAuditFrame>(
                payloadText[RelayControlPrefix.Length..],
                JsonSerializerOptions);

            if (controlFrame is null)
            {
                return false;
            }

            if (string.Equals(controlFrame.Kind, "doctor-command", StringComparison.Ordinal))
            {
                auditedCommand = new RelayAuditedCommand("doctor", Array.Empty<string>());
                return true;
            }

            if (!string.Equals(controlFrame.Kind, "attachment-command", StringComparison.Ordinal))
            {
                return false;
            }

            auditedCommand = new RelayAuditedCommand(
                string.IsNullOrWhiteSpace(controlFrame.Command)
                    ? "请分析这些附件，并总结关键信息。"
                    : controlFrame.Command.Trim(),
                controlFrame.Attachments
                    .Select(attachment => attachment.FileName)
                    .Where(fileName => !string.IsNullOrWhiteSpace(fileName))
                    .ToArray());

            return true;
        }
        catch
        {
            return false;
        }
    }
}

public sealed record RelayAuditedCommand(string CommandText, IReadOnlyList<string> AttachmentFileNames);

file sealed record RelayControlCommandAuditFrame(
    string Kind,
    string Command,
    IReadOnlyList<RelayAttachmentAuditPayload> Attachments);

file sealed record RelayAttachmentAuditPayload(string FileName);