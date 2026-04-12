using System.Text;
using System.Text.Json;
using CortexTerminal.Worker.Services;

namespace CortexTerminal.Worker.Tests;

public sealed class RelayAttachmentCommandProcessorTests
{
    [Fact]
    public void TryParseAttachmentCommand_WithValidEnvelope_ReturnsFrame()
    {
        var payload = new RelayAttachmentCommandFrame(
            "attachment-command",
            "请分析附件",
            [new RelayAttachmentPayload("att-1", "file", "demo.txt", "text/plain", 4, Convert.ToBase64String("demo"u8.ToArray()), null)]);
        var inbound = $"__ct_ctl__:{JsonSerializer.Serialize(payload)}";

        var parsed = RelayAttachmentCommandProcessor.TryParseAttachmentCommand(inbound, out var frame);

        Assert.True(parsed);
        Assert.NotNull(frame);
        Assert.Equal("请分析附件", frame!.Command);
        Assert.Single(frame.Attachments);
    }

    [Fact]
    public async Task StageAttachmentsAsync_WritesFilesAndBuildsAgentPrompt()
    {
        var workingDirectory = Path.Combine(Path.GetTempPath(), $"cortex-worker-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(workingDirectory);

        try
        {
            var payload = new RelayAttachmentCommandFrame(
                "attachment-command",
                "总结附件内容",
                [new RelayAttachmentPayload("att-1", "file", "notes.md", "text/markdown", 5, Convert.ToBase64String(Encoding.UTF8.GetBytes("hello")), null)]);

            var stagedAttachments = await RelayAttachmentCommandProcessor.StageAttachmentsAsync(
                payload,
                workingDirectory,
                "session-1",
                CancellationToken.None);

            var stagedAttachment = Assert.Single(stagedAttachments);
            Assert.True(File.Exists(stagedAttachment.AbsolutePath));
            Assert.StartsWith(".cortex-terminal", stagedAttachment.RelativePath, StringComparison.Ordinal);

            var prompt = RelayAttachmentCommandProcessor.BuildAgentCommand(payload, stagedAttachments);

            Assert.Contains("notes.md", prompt);
            Assert.Contains(stagedAttachment.RelativePath, prompt);
            Assert.Contains("总结附件内容", prompt);
        }
        finally
        {
            if (Directory.Exists(workingDirectory))
            {
                Directory.Delete(workingDirectory, true);
            }
        }
    }

    [Fact]
    public void TryParseDoctorCommand_WithValidEnvelope_ReturnsFrame()
    {
        const string inbound = "__ct_ctl__:{\"kind\":\"doctor-command\"}";

        var parsed = RelayAttachmentCommandProcessor.TryParseDoctorCommand(inbound, out var frame);

        Assert.True(parsed);
        Assert.NotNull(frame);
        Assert.Equal("doctor-command", frame!.Kind);
    }

    [Fact]
    public void TryParseTerminalResizeCommand_WithValidEnvelope_ReturnsFrame()
    {
        const string inbound = "__ct_ctl__:{\"kind\":\"terminal-resize\",\"cols\":132,\"rows\":37}";

        var parsed = RelayAttachmentCommandProcessor.TryParseTerminalResizeCommand(inbound, out var frame);

        Assert.True(parsed);
        Assert.NotNull(frame);
        Assert.Equal("terminal-resize", frame!.Kind);
        Assert.Equal(132, frame.Cols);
        Assert.Equal(37, frame.Rows);
    }
}
