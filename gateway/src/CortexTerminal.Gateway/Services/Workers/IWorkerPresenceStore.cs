namespace CortexTerminal.Gateway.Services.Workers;

public interface IWorkerPresenceStore
{
    Task MarkWorkerOnlineAsync(string workerId, string connectionId, CancellationToken cancellationToken);

    Task MarkWorkerOfflineAsync(string workerId, CancellationToken cancellationToken);

    Task<WorkerPresenceSnapshot?> GetWorkerPresenceAsync(string workerId, CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<string, WorkerPresenceSnapshot>> GetWorkerPresenceStatesAsync(IEnumerable<string> workerIds, CancellationToken cancellationToken);

    Task MarkSessionActiveAsync(string sessionId, string workerId, string mobileConnectionId, string? traceId, CancellationToken cancellationToken);

    Task TouchSessionAsync(string sessionId, string? traceId, CancellationToken cancellationToken);

    Task RemoveSessionAsync(string sessionId, CancellationToken cancellationToken);

    Task<SessionPresenceSnapshot?> GetSessionPresenceAsync(string sessionId, CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<string, SessionPresenceSnapshot>> GetSessionPresenceStatesAsync(IEnumerable<string> sessionIds, CancellationToken cancellationToken);
}

public sealed record WorkerPresenceSnapshot(string WorkerId, string ConnectionId, DateTime LastSeenUtc);

public sealed record SessionPresenceSnapshot(string SessionId, string WorkerId, string MobileConnectionId, string? TraceId, DateTime LastSeenUtc);
