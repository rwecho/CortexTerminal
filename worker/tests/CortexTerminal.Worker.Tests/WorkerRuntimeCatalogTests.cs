using CortexTerminal.Worker.Services;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerRuntimeCatalogTests
{
    [Theory]
    [InlineData("claude", "opencode", "claude")]
    [InlineData("codex", "claude", "codex")]
    [InlineData("gemini", "claude", "gemini")]
    [InlineData("opencode", "claude", "opencode")]
    [InlineData(null, "claude", "claude")]
    public void ResolveRuntimeCommandForSession_ReturnsExpectedRuntime(
        string? requestedAgentFamily,
        string fallbackRuntimeCommand,
        string expectedRuntimeCommand)
    {
        var runtimeCommand = WorkerRuntimeCatalog.ResolveRuntimeCommandForSession(
            requestedAgentFamily,
            fallbackRuntimeCommand);

        Assert.Equal(expectedRuntimeCommand, runtimeCommand);
    }

    [Fact]
    public void ResolveSupportedAgentFamilies_UsesConfiguredFamiliesWhenProvided()
    {
        var supportedAgentFamilies = WorkerRuntimeCatalog.ResolveSupportedAgentFamilies(
            "Claude CLI",
            "claude",
            "claude, codex, opencode");

        Assert.Equal(["claude", "codex", "opencode"], supportedAgentFamilies);
    }

    [Fact]
    public void ResolveSupportedAgentFamilies_WithoutConfiguration_DefaultsToAllKnownFamilies()
    {
        var supportedAgentFamilies = WorkerRuntimeCatalog.ResolveSupportedAgentFamilies(
            "Claude CLI",
            "claude",
            null);

        Assert.Equal(["claude", "codex", "gemini", "opencode"], supportedAgentFamilies);
    }

    [Fact]
    public void ResolveDefaultRuntimeCommand_InfersFromModelName()
    {
        var runtimeCommand = WorkerRuntimeCatalog.ResolveDefaultRuntimeCommand(
            "Gemini CLI",
            null);

        Assert.Equal("gemini", runtimeCommand);
    }
}
