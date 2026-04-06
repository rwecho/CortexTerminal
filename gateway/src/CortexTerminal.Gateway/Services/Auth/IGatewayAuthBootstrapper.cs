namespace CortexTerminal.Gateway.Services.Auth;

public interface IGatewayAuthBootstrapper
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}