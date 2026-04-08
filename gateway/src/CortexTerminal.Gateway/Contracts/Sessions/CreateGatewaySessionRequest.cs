namespace CortexTerminal.Gateway.Contracts.Sessions;

public sealed record CreateGatewaySessionRequest(
    string? SessionId,
    Guid? UserId,
    string? WorkerId,
    string? DisplayName,
    string? AgentFamily,
    string? WorkingDirectory,
    string? TraceId);
