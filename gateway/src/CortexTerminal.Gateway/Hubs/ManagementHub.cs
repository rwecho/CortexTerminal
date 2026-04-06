using CortexTerminal.Gateway.Services.Auth;
using Microsoft.AspNetCore.SignalR;
using OpenIddict.Abstractions;

namespace CortexTerminal.Gateway.Hubs;

public sealed class ManagementHub : Hub
{
    public Task SubscribeOverview()
    {
        EnsureGatewayUserCaller();
        return Task.CompletedTask;
    }

    private void EnsureGatewayUserCaller()
    {
        var principal = Context.User;
        if (principal is null)
        {
            throw new HubException("Authenticated gateway user token is required.");
        }

        if (principal.HasClaim(claim => claim.Type == GatewayClaimTypes.WorkerId)
            || !principal.HasClaim(claim => claim.Type == OpenIddictConstants.Claims.Subject))
        {
            throw new HubException("Authenticated gateway user token is required.");
        }
    }
}
