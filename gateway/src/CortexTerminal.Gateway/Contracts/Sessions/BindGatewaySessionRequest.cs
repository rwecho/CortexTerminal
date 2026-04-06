namespace CortexTerminal.Gateway.Contracts.Sessions;

public sealed record BindGatewaySessionRequest(
    string WorkerId,
    string? TraceId);
