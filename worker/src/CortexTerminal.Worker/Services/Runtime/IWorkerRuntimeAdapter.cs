namespace CortexTerminal.Worker.Services.Runtime;

public interface IWorkerRuntimeAdapter
{
    string AgentFamily { get; }

    bool SupportsResume { get; }

    bool RequiresPromptReadiness { get; }

    TimeSpan PromptReadyFallbackDelay { get; }

    WorkerRuntimeLaunchPlan BuildFreshPlan(WorkerRuntimeLaunchRequest request);

    WorkerRuntimeLaunchPlan BuildResumePlan(WorkerRuntimeLaunchRequest request);

    bool IsPromptReady(string transcript);

    bool IsPromptBlocked(string transcript);
}
