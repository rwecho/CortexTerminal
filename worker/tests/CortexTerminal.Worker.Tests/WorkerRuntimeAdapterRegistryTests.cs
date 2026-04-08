using CortexTerminal.Worker.Services.Runtime;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerRuntimeAdapterRegistryTests
{
    [Theory]
    [InlineData("claude", "claude", "claude")]
    [InlineData("codex", "codex", "codex")]
    [InlineData("opencode", "opencode", "opencode")]
    [InlineData(null, "claude", "claude")]
    public void Resolve_ReturnsExpectedAdapter(string? requestedAgentFamily, string runtimeCommand, string expectedAgentFamily)
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve(requestedAgentFamily, runtimeCommand);

        Assert.Equal(expectedAgentFamily, adapter.AgentFamily);
    }

    [Fact]
    public void ClaudeAdapter_BuildResumePlan_UsesClaudeResumeArguments()
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve("claude", "claude");

        var plan = adapter.BuildResumePlan(new WorkerRuntimeLaunchRequest(
            "claude",
            "claude",
            "/workspace/sample",
            ResumeSessionId: "session-claude-1",
            ForkSession: true));

        Assert.Equal(["--resume", "session-claude-1", "--fork-session"], plan.RuntimeArguments);
    }

    [Fact]
    public void CodexAdapter_BuildResumePlan_UsesCodexResumeSubcommand()
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve("codex", "codex");

        var plan = adapter.BuildResumePlan(new WorkerRuntimeLaunchRequest(
            "codex",
            "codex",
            "/workspace/sample",
            ResumeSessionId: "session-codex-1"));

        Assert.Equal(["resume", "session-codex-1"], plan.RuntimeArguments);
    }

    [Fact]
    public void OpenCodeAdapter_BuildResumePlan_UsesSessionFlag()
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve("opencode", "opencode");

        var plan = adapter.BuildResumePlan(new WorkerRuntimeLaunchRequest(
            "opencode",
            "opencode",
            "/workspace/sample",
            ResumeSessionId: "session-opencode-1"));

        Assert.Equal(["--session", "session-opencode-1"], plan.RuntimeArguments);
    }

    [Fact]
    public void GeminiAdapter_BuildResumePlan_ThrowsNotSupported()
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve("gemini", "gemini");

        Assert.Throws<NotSupportedException>(() => adapter.BuildResumePlan(new WorkerRuntimeLaunchRequest(
            "gemini",
            "gemini",
            "/workspace/sample",
            ResumeSessionId: "session-gemini-1")));
    }
}