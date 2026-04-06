using CortexTerminal.Gateway.Models.Auth;
using CortexTerminal.Gateway.Models.Users;

namespace CortexTerminal.Gateway.Services.Auth;

public interface IWorkerDeviceAuthorizationService
{
    Task<WorkerDeviceAuthorizationRecord> CreateChallengeAsync(
        string workerId,
        string displayName,
        IReadOnlyCollection<string> requestedScopes,
        CancellationToken cancellationToken);

    Task<WorkerDeviceAuthorizationRecord?> ApproveAsync(
        string userCode,
        GatewayUser approver,
        CancellationToken cancellationToken);

    Task<WorkerDeviceAuthorizationRecord?> RedeemApprovedChallengeAsync(
        string deviceCode,
        CancellationToken cancellationToken);
}
