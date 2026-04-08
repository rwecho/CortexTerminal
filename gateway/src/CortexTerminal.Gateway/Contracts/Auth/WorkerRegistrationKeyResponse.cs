namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record WorkerRegistrationKeyResponse(
    string RegistrationKey,
    string Subject,
    string? Username,
    string DisplayName,
    DateTime IssuedAtUtc);