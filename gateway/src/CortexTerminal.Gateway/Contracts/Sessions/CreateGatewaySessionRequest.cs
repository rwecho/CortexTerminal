namespace CortexTerminal.Gateway.Contracts.Sessions;

public sealed record CreateGatewaySessionRequest(
    string? SessionId,
    Guid? UserId,
    string? WorkerId,
    string? DisplayName,
    string? WorkingDirectory,
    string? TraceId);
