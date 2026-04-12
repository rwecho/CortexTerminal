namespace CortexTerminal.Worker.Services.Sessions;

public static class WorkerWorkingDirectoryResolver
{
    public static string Resolve(string? requestedWorkingDirectory, IReadOnlyList<string> availablePaths, string workerId)
    {
        var fallbackPath = availablePaths.Count > 0
            ? availablePaths[0]
            : Path.GetFullPath(Environment.CurrentDirectory);

        if (string.IsNullOrWhiteSpace(requestedWorkingDirectory))
        {
            return fallbackPath;
        }

        var normalizedRequestedPath = ExpandHomeDirectory(requestedWorkingDirectory);
        if (availablePaths.Count > 0 && !availablePaths.Contains(normalizedRequestedPath, StringComparer.Ordinal))
        {
            throw new InvalidOperationException($"Working directory '{normalizedRequestedPath}' is not allowed on worker '{workerId}'.");
        }

        if (!Directory.Exists(normalizedRequestedPath))
        {
            throw new DirectoryNotFoundException($"Working directory '{normalizedRequestedPath}' does not exist.");
        }

        return normalizedRequestedPath;
    }

    public static string ExpandHomeDirectory(string workingDirectory)
    {
        if (string.IsNullOrWhiteSpace(workingDirectory))
        {
            return Path.GetFullPath(Environment.CurrentDirectory);
        }

        if (workingDirectory == "~")
        {
            return GetHomeDirectory();
        }

        if (workingDirectory.StartsWith("~/", StringComparison.Ordinal)
            || workingDirectory.StartsWith("~\\", StringComparison.Ordinal))
        {
            var suffix = workingDirectory[2..]
                .Replace('/', Path.DirectorySeparatorChar)
                .Replace('\\', Path.DirectorySeparatorChar);
            return Path.GetFullPath(Path.Combine(GetHomeDirectory(), suffix));
        }

        return Path.GetFullPath(workingDirectory);
    }

    private static string GetHomeDirectory()
    {
        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return string.IsNullOrWhiteSpace(userProfile)
            ? Path.GetFullPath(Environment.CurrentDirectory)
            : Path.GetFullPath(userProfile);
    }
}
