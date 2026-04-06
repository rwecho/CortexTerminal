namespace CortexTerminal.Gateway.Contracts.Users;

public sealed record CreateGatewayUserRequest(
    string Username,
    string? DisplayName,
    string? Email,
    string? Password = null);
