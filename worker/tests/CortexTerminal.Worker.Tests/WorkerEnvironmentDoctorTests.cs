using CortexTerminal.Worker.Services;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerEnvironmentDoctorTests
{
    [Fact]
    public void BuildReport_IncludesAvailabilityAndMissingEntries()
    {
        var report = WorkerEnvironmentDoctor.BuildReport(
            "worker-1",
            "OpenCode CLI",
            "opencode",
            "/tmp/workdir",
            [
                new EnvironmentProbeResult("node", true, "v22.0.0", null),
                new EnvironmentProbeResult("opencode", true, "1.2.3", null),
                new EnvironmentProbeResult("codex", false, null, "missing from PATH")
            ]);

        Assert.Contains("[worker doctor] 环境诊断结果", report);
        Assert.Contains("workerId: worker-1", report);
        Assert.Contains("runtimeCommand: opencode", report);
        Assert.Contains("- node: v22.0.0", report);
        Assert.Contains("- codex: missing (missing from PATH)", report);
    }
}