using CortexTerminal.Gateway.Contracts.Workers;

namespace CortexTerminal.Gateway.Services.Workers;

public interface IWorkerManagementService
{
    Task<IReadOnlyList<WorkerNodeResponse>> ListAsync(CancellationToken cancellationToken);

    Task<bool> ReconcilePresenceAsync(CancellationToken cancellationToken);

    Task<WorkerNodeResponse?> GetAsync(string workerId, CancellationToken cancellationToken);

    Task<bool> DeleteOfflineAsync(string workerId, CancellationToken cancellationToken);

    Task<WorkerNodeResponse> UpsertAsync(UpsertWorkerRequest request, CancellationToken cancellationToken);

    Task RegisterConnectionAsync(string workerId, string connectionId, CancellationToken cancellationToken);

    Task MarkDisconnectedByConnectionAsync(string connectionId, CancellationToken cancellationToken);

    Task UnregisterAsync(string workerId, CancellationToken cancellationToken);

    Task RecordHeartbeatAsync(string workerId, CancellationToken cancellationToken);
}
