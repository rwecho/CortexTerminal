namespace CortexTerminal.Gateway.Services.Management;

public interface IManagementEventPublisher
{
    Task PublishWorkersChangedAsync();

    Task PublishSessionsChangedAsync();
}
