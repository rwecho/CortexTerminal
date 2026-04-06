using StackExchange.Redis;

namespace CortexTerminal.Gateway.Services.Workers;

public sealed class RedisWorkerPresenceStore(IConnectionMultiplexer connectionMultiplexer) : IWorkerPresenceStore
{
    private static readonly TimeSpan WorkerPresenceTtl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan SessionPresenceTtl = TimeSpan.FromHours(4);

    private IDatabase Database => connectionMultiplexer.GetDatabase();

    public async Task MarkWorkerOnlineAsync(string workerId, string connectionId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var key = GetWorkerKey(workerId);
        await Database.HashSetAsync(key, new[]
        {
            new HashEntry("workerId", workerId),
            new HashEntry("connectionId", connectionId),
            new HashEntry("lastSeenUtc", DateTime.UtcNow.ToString("O"))
        });
        await Database.KeyExpireAsync(key, WorkerPresenceTtl);
    }

    public async Task MarkWorkerOfflineAsync(string workerId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        await Database.KeyDeleteAsync(GetWorkerKey(workerId));
    }

    public async Task<WorkerPresenceSnapshot?> GetWorkerPresenceAsync(string workerId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var entries = await Database.HashGetAllAsync(GetWorkerKey(workerId));
        return entries.Length == 0 ? null : ParseWorkerPresence(workerId, entries);
    }

    public async Task<IReadOnlyDictionary<string, WorkerPresenceSnapshot>> GetWorkerPresenceStatesAsync(IEnumerable<string> workerIds, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var snapshots = new Dictionary<string, WorkerPresenceSnapshot>(StringComparer.Ordinal);

        foreach (var workerId in workerIds.Distinct(StringComparer.Ordinal))
        {
            var presence = await GetWorkerPresenceAsync(workerId, cancellationToken);
            if (presence is not null)
            {
                snapshots[workerId] = presence;
            }
        }

        return snapshots;
    }

    public async Task MarkSessionActiveAsync(string sessionId, string workerId, string mobileConnectionId, string? traceId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var key = GetSessionKey(sessionId);
        await Database.HashSetAsync(key, new[]
        {
            new HashEntry("sessionId", sessionId),
            new HashEntry("workerId", workerId),
            new HashEntry("mobileConnectionId", mobileConnectionId),
            new HashEntry("traceId", traceId ?? string.Empty),
            new HashEntry("lastSeenUtc", DateTime.UtcNow.ToString("O"))
        });
        await Database.KeyExpireAsync(key, SessionPresenceTtl);
    }

    public async Task TouchSessionAsync(string sessionId, string? traceId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var key = GetSessionKey(sessionId);
        if (!await Database.KeyExistsAsync(key))
        {
            return;
        }

        var updates = new List<HashEntry>
        {
            new("lastSeenUtc", DateTime.UtcNow.ToString("O"))
        };

        if (traceId is not null)
        {
            updates.Add(new HashEntry("traceId", traceId));
        }

        await Database.HashSetAsync(key, updates.ToArray());
        await Database.KeyExpireAsync(key, SessionPresenceTtl);
    }

    public async Task RemoveSessionAsync(string sessionId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        await Database.KeyDeleteAsync(GetSessionKey(sessionId));
    }

    public async Task<SessionPresenceSnapshot?> GetSessionPresenceAsync(string sessionId, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var entries = await Database.HashGetAllAsync(GetSessionKey(sessionId));
        return entries.Length == 0 ? null : ParseSessionPresence(sessionId, entries);
    }

    public async Task<IReadOnlyDictionary<string, SessionPresenceSnapshot>> GetSessionPresenceStatesAsync(IEnumerable<string> sessionIds, CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var snapshots = new Dictionary<string, SessionPresenceSnapshot>(StringComparer.Ordinal);

        foreach (var sessionId in sessionIds.Distinct(StringComparer.Ordinal))
        {
            var presence = await GetSessionPresenceAsync(sessionId, cancellationToken);
            if (presence is not null)
            {
                snapshots[sessionId] = presence;
            }
        }

        return snapshots;
    }

    private static string GetWorkerKey(string workerId) => $"gateway:workers:presence:{workerId}";

    private static string GetSessionKey(string sessionId) => $"gateway:sessions:presence:{sessionId}";

    private static WorkerPresenceSnapshot ParseWorkerPresence(string workerId, HashEntry[] entries)
    {
        var connectionId = entries.FirstOrDefault(entry => entry.Name == "connectionId").Value.ToString();
        var lastSeenText = entries.FirstOrDefault(entry => entry.Name == "lastSeenUtc").Value.ToString();
        var lastSeenUtc = DateTime.TryParse(lastSeenText, out var parsedLastSeen)
            ? DateTime.SpecifyKind(parsedLastSeen, DateTimeKind.Utc)
            : DateTime.UtcNow;

        return new WorkerPresenceSnapshot(workerId, connectionId, lastSeenUtc);
    }

    private static SessionPresenceSnapshot ParseSessionPresence(string sessionId, HashEntry[] entries)
    {
        var workerId = entries.FirstOrDefault(entry => entry.Name == "workerId").Value.ToString();
        var mobileConnectionId = entries.FirstOrDefault(entry => entry.Name == "mobileConnectionId").Value.ToString();
        var traceId = entries.FirstOrDefault(entry => entry.Name == "traceId").Value.ToString();
        var lastSeenText = entries.FirstOrDefault(entry => entry.Name == "lastSeenUtc").Value.ToString();
        var lastSeenUtc = DateTime.TryParse(lastSeenText, out var parsedLastSeen)
            ? DateTime.SpecifyKind(parsedLastSeen, DateTimeKind.Utc)
            : DateTime.UtcNow;

        return new SessionPresenceSnapshot(sessionId, workerId, mobileConnectionId, string.IsNullOrWhiteSpace(traceId) ? null : traceId, lastSeenUtc);
    }
}
