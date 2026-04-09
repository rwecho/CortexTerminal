using CortexTerminal.Gateway.Models.Users;

namespace CortexTerminal.Gateway.Services.Auth;

public interface IWorkerInstallTokenService
{
    Task<WorkerInstallTokenIssueResult> IssueAsync(GatewayUser user, CancellationToken cancellationToken);

    Task<WorkerInstallTokenConsumeResult?> ConsumeAsync(string token, CancellationToken cancellationToken);
}

public sealed record WorkerInstallTokenIssueResult(
    string Token,
    DateTime IssuedAtUtc,
    DateTime ExpiresAtUtc,
    GatewayUser User);

public sealed record WorkerInstallTokenConsumeResult(
    string Token,
    DateTime IssuedAtUtc,
    DateTime ExpiresAtUtc,
    GatewayUser User);
