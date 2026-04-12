namespace CortexTerminal.Worker.Services.Runtime.Adapters;

public sealed class ClaudeWorkerRuntimeAdapter() : WorkerRuntimeAdapterBase("claude")
{
    public override bool SupportsResume => true;
    public override bool RequiresPromptReadiness => true;

    public override WorkerRuntimeLaunchPlan BuildResumePlan(WorkerRuntimeLaunchRequest request)
    {
        ValidateRequest(request);
        var sessionId = RequireResumeSessionId(request, AgentFamily);
        var runtimeArguments = request.ForkSession
            ? new[] { "--resume", sessionId, "--fork-session" }
            : new[] { "--resume", sessionId };

        return WorkerRuntimeLaunchPlanner.BuildPlan(
            request.RuntimeCommand,
            request.WorkingDirectory,
            runtimeArguments);
    }

    public override bool IsPromptReady(string transcript)
    {
        if (string.IsNullOrWhiteSpace(transcript))
        {
            return false;
        }

        return transcript.Contains("? for shortcuts", StringComparison.OrdinalIgnoreCase)
            || transcript.Contains("bypass permissions on", StringComparison.OrdinalIgnoreCase)
            || transcript.Contains("/model to try", StringComparison.OrdinalIgnoreCase)
            || transcript.Contains("esc to interrupt", StringComparison.OrdinalIgnoreCase);
    }
}
