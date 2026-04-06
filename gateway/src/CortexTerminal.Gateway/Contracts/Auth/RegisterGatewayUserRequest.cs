namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record RegisterGatewayUserRequest(
    string Username,
    string Password,
    string? DisplayName,
    string? Email);