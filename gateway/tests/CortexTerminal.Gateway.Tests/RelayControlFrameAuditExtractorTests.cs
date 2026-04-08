using System.Text;
using CortexTerminal.Gateway.Services.Relay;

namespace CortexTerminal.Gateway.Tests;

public sealed class RelayControlFrameAuditExtractorTests
{
    [Fact]
    public void TryExtractAuditedCommand_WithPlainCommand_ReturnsCommand()
    {
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes("ls -la"));

        var extracted = RelayControlFrameAuditExtractor.TryExtractAuditedCommand(payload, out var auditedCommand);

        Assert.True(extracted);
        Assert.NotNull(auditedCommand);
        Assert.Equal("ls -la", auditedCommand!.CommandText);
        Assert.Empty(auditedCommand.AttachmentFileNames);
    }

    [Fact]
    public void TryExtractAuditedCommand_WithAttachmentEnvelope_ReturnsCommandAndFileNames()
    {
        const string inbound = "__ct_ctl__:{\"kind\":\"attachment-command\",\"command\":\"总结这些文件\",\"attachments\":[{\"fileName\":\"demo.txt\"},{\"fileName\":\"voice.wav\"}]}";
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(inbound));

        var extracted = RelayControlFrameAuditExtractor.TryExtractAuditedCommand(payload, out var auditedCommand);

        Assert.True(extracted);
        Assert.NotNull(auditedCommand);
        Assert.Equal("总结这些文件", auditedCommand!.CommandText);
        Assert.Equal(["demo.txt", "voice.wav"], auditedCommand.AttachmentFileNames);
    }

    [Fact]
    public void TryExtractAuditedCommand_WithDoctorEnvelope_ReturnsDoctorCommand()
    {
        const string inbound = "__ct_ctl__:{\"kind\":\"doctor-command\"}";
        var payload = Convert.ToBase64String(Encoding.UTF8.GetBytes(inbound));

        var extracted = RelayControlFrameAuditExtractor.TryExtractAuditedCommand(payload, out var auditedCommand);

        Assert.True(extracted);
        Assert.NotNull(auditedCommand);
        Assert.Equal("doctor", auditedCommand!.CommandText);
        Assert.Empty(auditedCommand.AttachmentFileNames);
    }
}