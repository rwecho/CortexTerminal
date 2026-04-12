using CortexTerminal.Gateway.Contracts.Workers;

namespace CortexTerminal.Gateway.Services.Workers;

public sealed class WorkerDirectoryBrowserService(
    IWorkerManagementService workerManagementService) : IWorkerDirectoryBrowserService
{
    public async Task<WorkerDirectoryBrowseResponse?> BrowseAsync(
        string workerId,
        string? path,
        CancellationToken cancellationToken)
    {
        var normalizedWorkerId = workerId.Trim();
        if (string.IsNullOrWhiteSpace(normalizedWorkerId))
        {
            throw new InvalidOperationException("WorkerId is required.");
        }

        var worker = await workerManagementService.GetAsync(normalizedWorkerId, cancellationToken);
        if (worker is null)
        {
            return null;
        }

        if (!worker.IsOnline)
        {
            throw new InvalidOperationException($"Worker '{normalizedWorkerId}' 当前离线，无法浏览目录。");
        }

        var availableRoots = worker.AvailablePaths
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        if (availableRoots.Length == 0)
        {
            throw new InvalidOperationException($"Worker '{normalizedWorkerId}' 未配置可浏览目录。");
        }

        if (string.IsNullOrWhiteSpace(path))
        {
            return new WorkerDirectoryBrowseResponse
            {
                WorkerId = worker.WorkerId,
                RequestedPath = null,
                Entries = availableRoots
                    .OrderBy(candidate => candidate, StringComparer.Ordinal)
                    .Select(candidate => new WorkerDirectoryEntryResponse
                    {
                        Path = candidate,
                        Name = GetDirectoryName(candidate),
                        HasChildren = true,
                        IsRoot = true
                    })
                    .ToArray()
            };
        }

        var normalizedPath = Path.GetFullPath(path);
        if (!IsAllowedPath(availableRoots, normalizedPath))
        {
            throw new InvalidOperationException($"Working directory '{normalizedPath}' is not allowed on worker '{normalizedWorkerId}'.");
        }

        if (!Directory.Exists(normalizedPath))
        {
            throw new DirectoryNotFoundException($"Working directory '{normalizedPath}' does not exist.");
        }

        return new WorkerDirectoryBrowseResponse
        {
            WorkerId = worker.WorkerId,
            RequestedPath = normalizedPath,
            Entries = Directory.EnumerateDirectories(normalizedPath)
                .Select(Path.GetFullPath)
                .OrderBy(candidate => candidate, StringComparer.Ordinal)
                .Select(candidate => new WorkerDirectoryEntryResponse
                {
                    Path = candidate,
                    Name = GetDirectoryName(candidate),
                    HasChildren = true,
                    IsRoot = false
                })
                .ToArray()
        };
    }

    private static bool IsAllowedPath(IReadOnlyList<string> availableRoots, string candidatePath)
    {
        return availableRoots.Any(root =>
            string.Equals(candidatePath, root, StringComparison.Ordinal)
            || candidatePath.StartsWith(BuildRootPrefix(root), StringComparison.Ordinal));
    }

    private static string BuildRootPrefix(string root)
    {
        if (root.EndsWith(Path.DirectorySeparatorChar)
            || root.EndsWith(Path.AltDirectorySeparatorChar))
        {
            return root;
        }

        return root + Path.DirectorySeparatorChar;
    }

    private static string GetDirectoryName(string path)
    {
        var trimmedPath = path.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (trimmedPath.Length == 0)
        {
            return path;
        }

        var name = Path.GetFileName(trimmedPath);
        return string.IsNullOrWhiteSpace(name) ? path : name;
    }
}
