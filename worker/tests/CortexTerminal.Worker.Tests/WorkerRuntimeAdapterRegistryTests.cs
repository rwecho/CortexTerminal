using CortexTerminal.Worker.Services.Runtime;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerRuntimeAdapterRegistryTests
{
    [Theory]
    [InlineData("claude", "claude", "claude")]
    [InlineData("copilot", "copilot", "copilot")]
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

    [Theory]
    [InlineData("codex", "OpenAI Codex\nmodel: gpt-5.4\n›", true)]
    [InlineData("codex", "Do you trust the contents of this directory?", false)]
    [InlineData("opencode", "Ask anything... /status", true)]
    [InlineData("copilot", "GitHub Copilot v1.0.24\nDescribe a task to get started.\nType @ to mention files", true)]
    [InlineData("copilot", "Loading environment", false)]
    public void Adapters_DetectPromptReadiness(string agentFamily, string transcript, bool expectedReady)
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve(agentFamily, agentFamily);

        Assert.Equal(expectedReady, adapter.IsPromptReady(transcript));
    }

    [Fact]
    public void CodexAdapter_BlocksFallbackWhileTrustPromptIsVisible()
    {
        var adapter = WorkerRuntimeAdapterRegistry.Resolve("codex", "codex");

        Assert.True(adapter.IsPromptBlocked("Do you trust the contents of this directory?"));
        Assert.Equal(TimeSpan.FromSeconds(5), adapter.PromptReadyFallbackDelay);
    }
}
