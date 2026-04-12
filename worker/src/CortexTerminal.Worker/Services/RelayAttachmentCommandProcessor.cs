using System.Text;
using System.Text.Json;

namespace CortexTerminal.Worker.Services;

public static class RelayAttachmentCommandProcessor
{
    private const string RelayControlPrefix = "__ct_ctl__:";

    private static readonly JsonSerializerOptions JsonSerializerOptions = new(JsonSerializerDefaults.Web);

    public static bool TryParseAttachmentCommand(
        string inbound,
        out RelayAttachmentCommandFrame? commandFrame)
    {
        commandFrame = null;

        if (!inbound.StartsWith(RelayControlPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            commandFrame = JsonSerializer.Deserialize<RelayAttachmentCommandFrame>(
                inbound[RelayControlPrefix.Length..],
                JsonSerializerOptions);

            return commandFrame is { Kind: "attachment-command", Attachments.Count: > 0 };
        }
        catch
        {
            commandFrame = null;
            return false;
        }
    }

    public static bool TryParseDoctorCommand(
        string inbound,
        out RelayDoctorCommandFrame? commandFrame)
    {
        commandFrame = null;

        if (!inbound.StartsWith(RelayControlPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            commandFrame = JsonSerializer.Deserialize<RelayDoctorCommandFrame>(
                inbound[RelayControlPrefix.Length..],
                JsonSerializerOptions);

            return commandFrame is { Kind: "doctor-command" };
        }
        catch
        {
            commandFrame = null;
            return false;
        }
    }

    public static bool TryParseTerminalResizeCommand(
        string inbound,
        out RelayTerminalResizeFrame? commandFrame)
    {
        commandFrame = null;

        if (!inbound.StartsWith(RelayControlPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            commandFrame = JsonSerializer.Deserialize<RelayTerminalResizeFrame>(
                inbound[RelayControlPrefix.Length..],
                JsonSerializerOptions);

            return commandFrame is { Kind: "terminal-resize", Cols: > 0, Rows: > 0 };
        }
        catch
        {
            commandFrame = null;
            return false;
        }
    }

    public static async Task<IReadOnlyList<StagedRelayAttachment>> StageAttachmentsAsync(
        RelayAttachmentCommandFrame commandFrame,
        string workingDirectory,
        string sessionId,
        CancellationToken cancellationToken)
    {
        var submissionDirectory = Path.Combine(
            workingDirectory,
            ".cortex-terminal",
            "attachments",
            SanitizePathSegment(sessionId),
            DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmssfff"));

        Directory.CreateDirectory(submissionDirectory);

        var stagedAttachments = new List<StagedRelayAttachment>(commandFrame.Attachments.Count);

        for (var index = 0; index < commandFrame.Attachments.Count; index += 1)
        {
            var attachment = commandFrame.Attachments[index];
            var extension = Path.GetExtension(attachment.FileName);
            var baseName = Path.GetFileNameWithoutExtension(attachment.FileName);
            var safeFileName = $"{index + 1:D2}-{SanitizeFileName(baseName)}{extension}";
            var absolutePath = Path.Combine(submissionDirectory, safeFileName);
            var relativePath = Path.GetRelativePath(workingDirectory, absolutePath);

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(attachment.Base64);
            }
            catch (FormatException exception)
            {
                throw new InvalidOperationException(
                    $"附件 '{attachment.FileName}' 不是合法的 base64 数据。",
                    exception);
            }

            await File.WriteAllBytesAsync(absolutePath, bytes, cancellationToken);

            stagedAttachments.Add(new StagedRelayAttachment(
                attachment.AttachmentId,
                attachment.Kind,
                attachment.FileName,
                attachment.MimeType,
                bytes.LongLength,
                absolutePath,
                relativePath,
                attachment.DurationMs));
        }

        return stagedAttachments;
    }

    public static string BuildWorkerConfirmationMessage(IReadOnlyList<StagedRelayAttachment> attachments)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"[worker] 已接收 {attachments.Count} 个附件：");

        foreach (var attachment in attachments)
        {
            builder.Append("- ")
                .Append(attachment.FileName)
                .Append(" -> ")
                .Append(attachment.RelativePath)
                .Append(" (")
                .Append(attachment.MimeType)
                .Append(", ")
                .Append(attachment.Size)
                .Append(" bytes");

            if (attachment.DurationMs is > 0)
            {
                builder.Append(", ").Append(attachment.DurationMs).Append(" ms");
            }

            builder.AppendLine(")");
        }

        return builder.ToString();
    }

    public static string BuildAgentCommand(
        RelayAttachmentCommandFrame commandFrame,
        IReadOnlyList<StagedRelayAttachment> attachments)
    {
        var builder = new StringBuilder();
        builder.AppendLine("系统注入：以下附件已从移动端同步到当前工作目录下，请先阅读附件再完成用户请求。");
        builder.AppendLine("附件列表：");

        foreach (var attachment in attachments)
        {
            builder.Append("- 名称: ")
                .Append(attachment.FileName)
                .Append("; 路径: ")
                .Append(attachment.RelativePath)
                .Append("; MIME: ")
                .Append(attachment.MimeType)
                .Append("; 大小: ")
                .Append(attachment.Size)
                .AppendLine(" bytes");
        }

        builder.AppendLine();
        builder.AppendLine("用户请求：");
        builder.AppendLine(string.IsNullOrWhiteSpace(commandFrame.Command)
            ? "请分析这些附件，并总结关键信息。"
            : commandFrame.Command.Trim());

        return builder.ToString();
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalidCharacters = Path.GetInvalidFileNameChars();
        var sanitizedCharacters = fileName
            .Select(character => invalidCharacters.Contains(character) ? '-' : character)
            .ToArray();

        var sanitized = new string(sanitizedCharacters).Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? "attachment" : sanitized;
    }

    private static string SanitizePathSegment(string value)
    {
        var invalidCharacters = Path.GetInvalidPathChars().Concat(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }).ToHashSet();
        var sanitizedCharacters = value
            .Select(character => invalidCharacters.Contains(character) ? '-' : character)
            .ToArray();

        var sanitized = new string(sanitizedCharacters).Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? "session" : sanitized;
    }
}

public sealed record RelayAttachmentCommandFrame(
    string Kind,
    string Command,
    IReadOnlyList<RelayAttachmentPayload> Attachments);

public sealed record RelayAttachmentPayload(
    string AttachmentId,
    string Kind,
    string FileName,
    string MimeType,
    long Size,
    string Base64,
    long? DurationMs);

public sealed record StagedRelayAttachment(
    string AttachmentId,
    string Kind,
    string FileName,
    string MimeType,
    long Size,
    string AbsolutePath,
    string RelativePath,
    long? DurationMs);

public sealed record RelayDoctorCommandFrame(string Kind);

public sealed record RelayTerminalResizeFrame(string Kind, int Cols, int Rows);
