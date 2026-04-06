using CortexTerminal.Gateway.Contracts.Users;

namespace CortexTerminal.Gateway.Services.Users;

public interface IUserManagementService
{
    Task<IReadOnlyList<GatewayUserResponse>> ListAsync(CancellationToken cancellationToken);

    Task<GatewayUserResponse?> GetAsync(Guid userId, CancellationToken cancellationToken);

    Task<GatewayUserResponse> CreateAsync(CreateGatewayUserRequest request, CancellationToken cancellationToken);
}
