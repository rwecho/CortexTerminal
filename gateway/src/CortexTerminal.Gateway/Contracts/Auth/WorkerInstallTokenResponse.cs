namespace CortexTerminal.Gateway.Contracts.Auth;

public sealed record WorkerInstallCommandSet(
    string UnixUrl,
    string UnixCommand,
    string WindowsUrl,
    string WindowsCommand);

public sealed record WorkerInstallTokenResponse(
    string Token,
    DateTime IssuedAtUtc,
    DateTime ExpiresAtUtc,
    string InstallUrl,
    string InstallCommand,
    WorkerInstallCommandSet InstallCommands);
