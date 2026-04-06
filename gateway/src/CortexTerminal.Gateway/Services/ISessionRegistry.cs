namespace CortexTerminal.Gateway.Services;

public interface ISessionRegistry
{
    void RegisterWorker(string workerId, string connectionId);
    bool TryGetWorkerConnection(string workerId, out string connectionId);

    void BindSessionToWorker(string sessionId, string workerId);
    bool TryGetWorkerBySession(string sessionId, out string workerId);

    void RegisterMobileSessionConnection(string sessionId, string connectionId);
    bool TryGetMobileConnectionBySession(string sessionId, out string connectionId);

    void RemoveConnection(string connectionId);
}
