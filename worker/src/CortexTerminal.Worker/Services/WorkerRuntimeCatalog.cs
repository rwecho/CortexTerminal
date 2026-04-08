namespace CortexTerminal.Worker.Services;

public static class WorkerRuntimeCatalog
{
    private static readonly string[] KnownAgentFamilies = ["claude", "codex", "gemini", "opencode"];

    public static IReadOnlyList<string> AllAgentFamilies => KnownAgentFamilies;

    public static IReadOnlyList<string> ResolveSupportedAgentFamilies(
        string workerModelName,
        string workerRuntimeCommand,
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

        return KnownAgentFamilies;
    }

    public static string ResolveDefaultRuntimeCommand(string workerModelName, string? configuredCommand)
    {
        if (!string.IsNullOrWhiteSpace(configuredCommand))
        {
            return configuredCommand.Trim();
        }

        var normalizedModelName = workerModelName.Trim().ToLowerInvariant();
        if (normalizedModelName.Contains("codex"))
        {
            return "codex";
        }

        if (normalizedModelName.Contains("gemini"))
        {
            return "gemini";
        }

        if (normalizedModelName.Contains("opencode") || normalizedModelName.Contains("open code"))
        {
            return "opencode";
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
}