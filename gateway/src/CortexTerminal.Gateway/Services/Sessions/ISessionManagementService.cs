using CortexTerminal.Gateway.Contracts.Sessions;

namespace CortexTerminal.Gateway.Services.Sessions;

public interface ISessionManagementService
{
    Task<IReadOnlyList<GatewaySessionResponse>> ListAsync(CancellationToken cancellationToken);

    Task<GatewaySessionResponse?> GetAsync(string sessionId, CancellationToken cancellationToken);

    Task<GatewaySessionResponse> CreateAsync(CreateGatewaySessionRequest request, CancellationToken cancellationToken);

    Task<GatewaySessionResponse?> BindSessionAsync(string sessionId, BindGatewaySessionRequest request, CancellationToken cancellationToken);

    Task ActivateBindingAsync(string sessionId, string workerId, string mobileConnectionId, CancellationToken cancellationToken);

    Task TouchAsync(string sessionId, string? traceId, CancellationToken cancellationToken);

    Task MarkDisconnectedByConnectionAsync(string connectionId, CancellationToken cancellationToken);

    Task<GatewaySessionResponse?> CloseAsync(string sessionId, CancellationToken cancellationToken);
}
