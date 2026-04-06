using CortexTerminal.Gateway.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace CortexTerminal.Gateway.Services.Management;

public sealed class ManagementHubEventPublisher(
    IHubContext<ManagementHub> hubContext,
    ILogger<ManagementHubEventPublisher> logger) : IManagementEventPublisher
{
    private const string WorkersChangedMethod = "WorkersChanged";
    private const string SessionsChangedMethod = "SessionsChanged";

    public async Task PublishWorkersChangedAsync()
    {
        logger.LogDebug("[management-hub] Broadcasting workers changed event.");
        await hubContext.Clients.All.SendAsync(WorkersChangedMethod);
    }

    public async Task PublishSessionsChangedAsync()
    {
        logger.LogDebug("[management-hub] Broadcasting sessions changed event.");
        await hubContext.Clients.All.SendAsync(SessionsChangedMethod);
    }
}
