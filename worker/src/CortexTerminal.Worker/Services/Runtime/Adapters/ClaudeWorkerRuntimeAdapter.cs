namespace CortexTerminal.Worker.Services.Runtime.Adapters;

public sealed class ClaudeWorkerRuntimeAdapter() : WorkerRuntimeAdapterBase("claude")
{
    public override bool SupportsResume => true;

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
}