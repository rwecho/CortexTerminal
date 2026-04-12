namespace CortexTerminal.Worker.Services.Sessions;

public sealed class WorkerDirectoryBrowser(string workerId, IReadOnlyList<string> availablePaths)
{
    private readonly string workerId = workerId;
    private readonly string[] availableRoots = availablePaths
        .Where(path => !string.IsNullOrWhiteSpace(path))
        .Select(path => Path.GetFullPath(WorkerWorkingDirectoryResolver.ExpandHomeDirectory(path)))
        .Distinct(StringComparer.Ordinal)
        .ToArray();

    public Task<WorkerDirectoryBrowseResponse> BrowseAsync(string? requestedPath, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        if (availableRoots.Length == 0)
        {
            throw new InvalidOperationException($"Worker '{workerId}' 未配置可浏览目录。");
        }

        if (string.IsNullOrWhiteSpace(requestedPath))
        {
            return Task.FromResult(new WorkerDirectoryBrowseResponse
            {
                WorkerId = workerId,
                RequestedPath = null,
                Entries = availableRoots
                    .OrderBy(path => path, StringComparer.Ordinal)
                    .Select(path => new WorkerDirectoryEntryResponse
                    {
                        Path = path,
                        Name = GetDirectoryName(path),
                        HasChildren = true,
                        IsRoot = true
                    })
                    .ToArray()
            });
        }

        var normalizedRequestedPath = Path.GetFullPath(
            WorkerWorkingDirectoryResolver.ExpandHomeDirectory(requestedPath));

        if (!IsAllowedPath(normalizedRequestedPath))
        {
            throw new InvalidOperationException($"Working directory '{normalizedRequestedPath}' is not allowed on worker '{workerId}'.");
        }

        if (!Directory.Exists(normalizedRequestedPath))
        {
            throw new DirectoryNotFoundException($"Working directory '{normalizedRequestedPath}' does not exist.");
        }

        var entries = Directory.EnumerateDirectories(normalizedRequestedPath)
            .Select(path => Path.GetFullPath(path))
            .OrderBy(path => path, StringComparer.Ordinal)
            .Select(path => new WorkerDirectoryEntryResponse
            {
                Path = path,
                Name = GetDirectoryName(path),
                HasChildren = true,
                IsRoot = false
            })
            .ToArray();

        return Task.FromResult(new WorkerDirectoryBrowseResponse
        {
            WorkerId = workerId,
            RequestedPath = normalizedRequestedPath,
            Entries = entries
        });
    }

    private bool IsAllowedPath(string candidatePath)
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
