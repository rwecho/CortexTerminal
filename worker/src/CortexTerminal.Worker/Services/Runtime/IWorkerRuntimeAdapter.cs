namespace CortexTerminal.Worker.Services.Runtime;

public interface IWorkerRuntimeAdapter
{
    string AgentFamily { get; }

    bool SupportsResume { get; }

    WorkerRuntimeLaunchPlan BuildFreshPlan(WorkerRuntimeLaunchRequest request);

    WorkerRuntimeLaunchPlan BuildResumePlan(WorkerRuntimeLaunchRequest request);
}