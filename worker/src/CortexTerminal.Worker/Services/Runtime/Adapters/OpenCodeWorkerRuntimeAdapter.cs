namespace CortexTerminal.Worker.Services.Runtime.Adapters;

public sealed class OpenCodeWorkerRuntimeAdapter() : WorkerRuntimeAdapterBase("opencode")
{
    public override bool SupportsResume => true;

    public override WorkerRuntimeLaunchPlan BuildResumePlan(WorkerRuntimeLaunchRequest request)
    {
        ValidateRequest(request);
        var sessionId = RequireResumeSessionId(request, AgentFamily);
        var runtimeArguments = request.ForkSession
            ? new[] { "--session", sessionId, "--fork" }
            : new[] { "--session", sessionId };

        return WorkerRuntimeLaunchPlanner.BuildPlan(
            request.RuntimeCommand,
            request.WorkingDirectory,
            runtimeArguments);
    }
}