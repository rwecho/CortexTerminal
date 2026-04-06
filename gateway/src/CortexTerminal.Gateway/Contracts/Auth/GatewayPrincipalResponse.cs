namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record GatewayPrincipalResponse(
    string Subject,
    string? Username,
    string? DisplayName,
    string? Email,
    IReadOnlyList<string> Scopes,
    string? ClientId);