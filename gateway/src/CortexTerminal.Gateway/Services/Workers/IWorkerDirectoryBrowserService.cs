using CortexTerminal.Gateway.Contracts.Workers;

namespace CortexTerminal.Gateway.Services.Workers;

public interface IWorkerDirectoryBrowserService
{
    Task<WorkerDirectoryBrowseResponse?> BrowseAsync(string workerId, string? path, CancellationToken cancellationToken);
}
