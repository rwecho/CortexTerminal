namespace CortexTerminal.Worker.Services.Runtime;

public abstract class WorkerRuntimeAdapterBase(string agentFamily) : IWorkerRuntimeAdapter
{
    public string AgentFamily { get; } = agentFamily;

    public virtual bool SupportsResume => false;

    public virtual WorkerRuntimeLaunchPlan BuildFreshPlan(WorkerRuntimeLaunchRequest request)
    {
        ValidateRequest(request);
        return WorkerRuntimeLaunchPlanner.BuildPlan(request.RuntimeCommand, request.WorkingDirectory);
    }

    public virtual WorkerRuntimeLaunchPlan BuildResumePlan(WorkerRuntimeLaunchRequest request)
    {
        ValidateRequest(request);
        throw new NotSupportedException($"Runtime adapter '{AgentFamily}' does not support session resume.");
    }

    protected static void ValidateRequest(WorkerRuntimeLaunchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RuntimeCommand))
        {
            throw new InvalidOperationException("Runtime command is required.");
        }

        if (string.IsNullOrWhiteSpace(request.WorkingDirectory))
        {
            throw new InvalidOperationException("Working directory is required.");
        }
    }

    protected static string RequireResumeSessionId(WorkerRuntimeLaunchRequest request, string agentFamily)
    {
        if (string.IsNullOrWhiteSpace(request.ResumeSessionId))
        {
            throw new InvalidOperationException($"Runtime adapter '{agentFamily}' requires a resume session id.");
        }

        return request.ResumeSessionId.Trim();
    }
}