namespace CortexTerminal.Worker.Services.Sessions;

public sealed record WorkerSessionCleanupDecision(
    bool ShouldCleanup,
    bool CloseGatewaySession,
    string ReasonCode,
    string ReasonMessage)
{
    public static WorkerSessionCleanupDecision None { get; } = new(
        false,
        false,
        "none",
        "No cleanup required.");
}