namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record CreateWorkerDeviceAuthorizationRequest(
    string WorkerId,
    string DisplayName,
    string? Scope);
