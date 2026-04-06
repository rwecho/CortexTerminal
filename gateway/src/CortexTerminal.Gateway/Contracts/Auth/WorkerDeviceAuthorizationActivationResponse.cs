namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record WorkerDeviceAuthorizationActivationResponse(
    string WorkerId,
    string DisplayName,
    string UserCode,
    string ApprovedBy,
    DateTime ApprovedAtUtc);
