using CortexTerminal.Gateway.Models.Users;

namespace CortexTerminal.Gateway.Services.Auth;

public interface IWorkerRegistrationKeyService
{
    Task<WorkerRegistrationKeyIssueResult> IssueAsync(GatewayUser user, CancellationToken cancellationToken);

    Task<WorkerRegistrationKeyValidationResult?> ValidateAsync(string registrationKey, CancellationToken cancellationToken);
}

public sealed record WorkerRegistrationKeyIssueResult(
    string RegistrationKey,
    DateTime IssuedAtUtc,
    GatewayUser User);

public sealed record WorkerRegistrationKeyValidationResult(
    GatewayUser User,
    DateTime IssuedAtUtc);