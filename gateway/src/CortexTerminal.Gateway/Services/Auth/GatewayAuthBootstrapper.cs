using CortexTerminal.Gateway.Configuration;
using Microsoft.Extensions.Options;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CortexTerminal.Gateway.Services.Auth;

public sealed class GatewayAuthBootstrapper(
    IOpenIddictApplicationManager applicationManager,
    IOptions<GatewayAuthOptions> authOptions) : IGatewayAuthBootstrapper
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        var options = authOptions.Value;
        var existingApplication = await applicationManager.FindByClientIdAsync(options.WorkerClientId, cancellationToken);
        if (existingApplication is not null)
        {
            return;
        }

        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = options.WorkerClientId,
            ClientSecret = options.WorkerClientSecret,
            ClientType = ClientTypes.Confidential,
            ConsentType = ConsentTypes.Implicit,
            DisplayName = "Cortex Worker Device"
        };

        descriptor.Permissions.Add(Permissions.Endpoints.Token);
        descriptor.Permissions.Add(Permissions.GrantTypes.ClientCredentials);
        descriptor.Permissions.Add(Permissions.Prefixes.Scope + "relay.connect");
        descriptor.Permissions.Add(Permissions.Prefixes.Scope + "worker.manage");

        await applicationManager.CreateAsync(descriptor, cancellationToken);
    }
}