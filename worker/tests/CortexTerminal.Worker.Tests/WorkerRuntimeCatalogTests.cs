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
            "claude, codex, opencode");

        Assert.Equal(["claude", "codex", "opencode"], supportedAgentFamilies);
    }

    [Fact]
    public void ResolveSupportedAgentFamilies_WithoutConfiguration_ReturnsDetectedOrFallbackFamilies()
    {
        var supportedAgentFamilies = WorkerRuntimeCatalog.ResolveSupportedAgentFamilies(
            null);

        Assert.NotEmpty(supportedAgentFamilies);
    }

    [Fact]
    public void ResolveDefaultRuntimeCommand_InfersFromModelName()
    {
        var runtimeCommand = WorkerRuntimeCatalog.ResolveDefaultRuntimeCommand(
            ["claude", "gemini"],
            null,
            "Gemini CLI");

        Assert.Equal("gemini", runtimeCommand);
    }

    [Fact]
    public void ResolveWorkerModelName_WithMultipleFamilies_ReturnsMultiRuntimeLabel()
    {
        var workerModelName = WorkerRuntimeCatalog.ResolveWorkerModelName(
            null,
            ["claude", "codex"],
            "claude");

        Assert.Equal("Multi-runtime worker (claude, codex)", workerModelName);
    }
}
