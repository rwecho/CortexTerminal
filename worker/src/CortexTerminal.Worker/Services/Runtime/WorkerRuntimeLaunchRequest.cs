namespace CortexTerminal.Worker.Services.Runtime;

public sealed record WorkerRuntimeLaunchRequest(
    string AgentFamily,
    string RuntimeCommand,
    string WorkingDirectory,
    string? ResumeSessionId = null,
    bool ForkSession = false);