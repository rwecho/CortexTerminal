namespace CortexTerminal.Worker.Services;

public static class WorkerRuntimeCatalog
{
    private static readonly string[] KnownAgentFamilies = ["claude", "codex", "gemini", "opencode"];

    public static IReadOnlyList<string> AllAgentFamilies => KnownAgentFamilies;

    public static IReadOnlyList<string> ResolveSupportedAgentFamilies(
        string? configuredSupportedAgentFamilies)
    {
        var configuredFamilies = configuredSupportedAgentFamilies?
            .Split([',', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeAgentFamily)
            .Where(family => !string.IsNullOrWhiteSpace(family))
            .Distinct(StringComparer.Ordinal)
            .Cast<string>()
            .ToArray();

        if (configuredFamilies is { Length: > 0 })
        {
            return configuredFamilies;
        }

        var detectedFamilies = DetectInstalledAgentFamilies().ToArray();
        return detectedFamilies.Length > 0 ? detectedFamilies : ["claude"];
    }

    public static string ResolveDefaultRuntimeCommand(
        IReadOnlyList<string> supportedAgentFamilies,
        string? configuredCommand,
        string? workerModelName = null)
    {
        if (!string.IsNullOrWhiteSpace(configuredCommand))
        {
            return configuredCommand.Trim();
        }

        var normalizedModelName = workerModelName?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedModelName) && normalizedModelName.Contains("codex"))
        {
            return "codex";
        }

        if (!string.IsNullOrWhiteSpace(normalizedModelName) && normalizedModelName.Contains("gemini"))
        {
            return "gemini";
        }

        if (!string.IsNullOrWhiteSpace(normalizedModelName)
            && (normalizedModelName.Contains("opencode") || normalizedModelName.Contains("open code")))
        {
            return "opencode";
        }

        if (supportedAgentFamilies.Count > 0)
        {
            return supportedAgentFamilies[0];
        }

        return "claude";
    }

    public static string ResolveRuntimeCommandForSession(string? requestedAgentFamily, string fallbackRuntimeCommand)
    {
        var normalizedAgentFamily = NormalizeAgentFamily(requestedAgentFamily);
        return normalizedAgentFamily switch
        {
            "codex" => "codex",
            "gemini" => "gemini",
            "opencode" => "opencode",
            "claude" => "claude",
            _ => fallbackRuntimeCommand,
        };
    }

    public static string InferAgentFamily(string workerModelName, string workerRuntimeCommand)
    {
        var fromModelName = NormalizeAgentFamily(workerModelName);
        if (!string.IsNullOrWhiteSpace(fromModelName))
        {
            return fromModelName;
        }

        var fromRuntimeCommand = NormalizeAgentFamily(workerRuntimeCommand);
        return string.IsNullOrWhiteSpace(fromRuntimeCommand)
            ? "claude"
            : fromRuntimeCommand;
    }

    public static string ResolveAgentFamily(string? requestedAgentFamily, string fallbackRuntimeCommand)
    {
        return NormalizeAgentFamily(requestedAgentFamily)
            ?? NormalizeAgentFamily(fallbackRuntimeCommand)
            ?? "claude";
    }

    public static string ResolveWorkerModelName(
        string? configuredWorkerModelName,
        IReadOnlyList<string> supportedAgentFamilies,
        string defaultRuntimeCommand)
    {
        if (!string.IsNullOrWhiteSpace(configuredWorkerModelName))
        {
            return configuredWorkerModelName.Trim();
        }

        return supportedAgentFamilies.Count switch
        {
            0 => $"{defaultRuntimeCommand} runtime",
            1 => $"{supportedAgentFamilies[0]} runtime",
            _ => $"Multi-runtime worker ({string.Join(", ", supportedAgentFamilies)})"
        };
    }

    public static IReadOnlyList<string> DetectInstalledAgentFamilies()
    {
        return KnownAgentFamilies
            .Where(IsCommandAvailable)
            .ToArray();
    }

    private static string? NormalizeAgentFamily(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Contains("open code", StringComparison.Ordinal) || normalized.Contains("opencode", StringComparison.Ordinal))
        {
            return "opencode";
        }

        return KnownAgentFamilies.Contains(normalized, StringComparer.Ordinal)
            ? normalized
            : normalized.Contains("codex", StringComparison.Ordinal)
                ? "codex"
                : normalized.Contains("gemini", StringComparison.Ordinal)
                    ? "gemini"
                    : normalized.Contains("claude", StringComparison.Ordinal)
                        ? "claude"
                        : null;
    }

    private static bool IsCommandAvailable(string candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
        {
            return false;
        }

        var pathValue = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(pathValue))
        {
            return false;
        }

        var pathExtensions = OperatingSystem.IsWindows()
            ? (Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT;.PS1")
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            : [string.Empty];

        foreach (var pathSegment in pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var basePath = Path.Combine(pathSegment, candidate);
            if (File.Exists(basePath))
            {
                return true;
            }

            foreach (var extension in pathExtensions)
            {
                var candidatePath = string.IsNullOrWhiteSpace(extension) || basePath.EndsWith(extension, StringComparison.OrdinalIgnoreCase)
                    ? basePath
                    : basePath + extension;

                if (File.Exists(candidatePath))
                {
                    return true;
                }
            }
        }

        return false;
    }
}