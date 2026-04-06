using System.Collections.Concurrent;

namespace CortexTerminal.Gateway.Services;

public sealed class InMemorySessionRegistry : ISessionRegistry
{
    private readonly ConcurrentDictionary<string, string> _workerById = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, string> _workerIdByConnection = new(StringComparer.Ordinal);

    private readonly ConcurrentDictionary<string, string> _workerBySession = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, string> _mobileBySession = new(StringComparer.Ordinal);

    public void RegisterWorker(string workerId, string connectionId)
    {
        _workerById[workerId] = connectionId;
        _workerIdByConnection[connectionId] = workerId;
    }

    public bool TryGetWorkerConnection(string workerId, out string connectionId)
    {
        return _workerById.TryGetValue(workerId, out connectionId!);
    }

    public void BindSessionToWorker(string sessionId, string workerId)
    {
        _workerBySession[sessionId] = workerId;
    }

    public bool TryGetWorkerBySession(string sessionId, out string workerId)
    {
        return _workerBySession.TryGetValue(sessionId, out workerId!);
    }

    public void RegisterMobileSessionConnection(string sessionId, string connectionId)
    {
        _mobileBySession[sessionId] = connectionId;
    }

    public bool TryGetMobileConnectionBySession(string sessionId, out string connectionId)
    {
        return _mobileBySession.TryGetValue(sessionId, out connectionId!);
    }

    public void RemoveConnection(string connectionId)
    {
        if (_workerIdByConnection.TryRemove(connectionId, out var workerId))
        {
            _workerById.TryRemove(workerId, out _);

            foreach (var kv in _workerBySession.Where(kv => string.Equals(kv.Value, workerId, StringComparison.Ordinal)))
            {
                _workerBySession.TryRemove(kv.Key, out _);
            }
        }

        foreach (var kv in _mobileBySession.Where(kv => string.Equals(kv.Value, connectionId, StringComparison.Ordinal)))
        {
            _mobileBySession.TryRemove(kv.Key, out _);
        }
    }
}
