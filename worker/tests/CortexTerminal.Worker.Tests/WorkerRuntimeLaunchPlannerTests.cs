using CortexTerminal.Worker.Services.Runtime;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerRuntimeLaunchPlannerTests
{
    [Fact]
    public void BuildUnixPlan_UsesShellScriptAndRuntimeArguments()
    {
        var scriptsDirectory = "/tmp/cortex-worker-scripts";
        var entrypointPath = Path.Combine(scriptsDirectory, "entrypoint.sh");

        var plan = WorkerRuntimeLaunchPlanner.BuildUnixPlan(
            "codex",
            "/workspace/sample",
            scriptsDirectory,
            "/bin/bash",
            entrypointPath);

        Assert.Equal("/bin/bash", plan.ShellApp);
        Assert.Equal(entrypointPath, plan.EntrypointPath);
        Assert.Equal("codex", plan.RuntimeCommand);
        Assert.Equal(
            [entrypointPath, "--runtime", "codex", "--working-directory", "/workspace/sample"],
            plan.CommandLine);
        Assert.Equal("codex", plan.Environment["CT_RUNTIME_COMMAND"]);
        Assert.Equal("unix", plan.Environment["CT_RUNTIME_ENTRYPOINT_PLATFORM"]);
    }

    [Fact]
    public void BuildWindowsPlan_UsesPowerShellFileInvocation()
    {
        var scriptsDirectory = @"C:\cortex-worker\scripts";
        var entrypointPath = Path.Combine(scriptsDirectory, "entrypoint.ps1");

        var plan = WorkerRuntimeLaunchPlanner.BuildWindowsPlan(
            "gemini",
            @"C:\workspace\sample",
            scriptsDirectory,
            "pwsh.exe",
            entrypointPath);

        Assert.Equal("pwsh.exe", plan.ShellApp);
        Assert.Equal(entrypointPath, plan.EntrypointPath);
        Assert.Equal("gemini", plan.RuntimeCommand);
        Assert.Equal(
            [
                "-NoLogo",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                entrypointPath,
                "-Runtime",
                "gemini",
                "-WorkingDirectory",
                @"C:\workspace\sample"
            ],
            plan.CommandLine);
        Assert.Equal("windows", plan.Environment["CT_RUNTIME_ENTRYPOINT_PLATFORM"]);
    }

    [Fact]
    public void BuildUnixPlan_WithRuntimeArguments_ForwardsArgumentsToEntrypoint()
    {
        var scriptsDirectory = "/tmp/cortex-worker-scripts";
        var entrypointPath = Path.Combine(scriptsDirectory, "entrypoint.sh");

        var plan = WorkerRuntimeLaunchPlanner.BuildUnixPlan(
            "claude",
            "/workspace/sample",
            scriptsDirectory,
            "/bin/bash",
            entrypointPath,
            ["--resume", "session-123", "--fork-session"]);

        Assert.Equal(
            [
                entrypointPath,
                "--runtime",
                "claude",
                "--working-directory",
                "/workspace/sample",
                "--runtime-arg",
                "--resume",
                "--runtime-arg",
                "session-123",
                "--runtime-arg",
                "--fork-session"
            ],
            plan.CommandLine);
        Assert.Equal(["--resume", "session-123", "--fork-session"], plan.RuntimeArguments);
    }

    [Fact]
    public void ToPtyOptions_UsesDefaultTerminalDimensions()
    {
        var plan = new WorkerRuntimeLaunchPlan(
            "/bin/bash",
            "/tmp/entrypoint.sh",
            "codex",
            "/workspace/sample",
            ["/tmp/entrypoint.sh", "--runtime", "codex"],
            new Dictionary<string, string>());

        var options = plan.ToPtyOptions();

        Assert.Equal(120, options.Cols);
        Assert.Equal(40, options.Rows);
    }
}
