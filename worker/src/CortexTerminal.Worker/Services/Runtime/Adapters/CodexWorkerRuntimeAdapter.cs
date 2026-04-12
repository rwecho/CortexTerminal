namespace CortexTerminal.Worker.Services.Runtime.Adapters;

public sealed class CodexWorkerRuntimeAdapter() : WorkerRuntimeAdapterBase("codex")
{
    public override bool SupportsResume => true;
    public override bool RequiresPromptReadiness => true;
    public override TimeSpan PromptReadyFallbackDelay => TimeSpan.FromSeconds(5);

    public override WorkerRuntimeLaunchPlan BuildResumePlan(WorkerRuntimeLaunchRequest request)
    {
        ValidateRequest(request);
        var sessionId = RequireResumeSessionId(request, AgentFamily);
        var runtimeArguments = request.ForkSession
            ? new[] { "fork", sessionId }
            : new[] { "resume", sessionId };

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

        return transcript.Contains("OpenAI Codex", StringComparison.OrdinalIgnoreCase)
            && (transcript.Contains("model:", StringComparison.OrdinalIgnoreCase)
                || transcript.Contains("/review", StringComparison.OrdinalIgnoreCase)
                || transcript.Contains("esc to interrupt", StringComparison.OrdinalIgnoreCase))
            && (transcript.Contains('›') || transcript.Contains('>'));
    }

    public override bool IsPromptBlocked(string transcript)
    {
        return transcript.Contains("Do you trust the contents of this directory?", StringComparison.OrdinalIgnoreCase)
            || transcript.Contains("Working with untrusted contents", StringComparison.OrdinalIgnoreCase);
    }
}
