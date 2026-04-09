namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record WorkerInstallTokenResponse(
    string Token,
    DateTime IssuedAtUtc,
    DateTime ExpiresAtUtc,
    string InstallUrl,
    string InstallCommand);
