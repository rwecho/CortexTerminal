using System.Text.Json;

namespace CortexTerminal.Gateway.Services.Workers;

public static class WorkerAgentFamilySupport
{
    private static readonly string[] KnownAgentFamilies = ["claude", "codex", "gemini", "opencode", "copilot"];

    public static IReadOnlyList<string> AllAgentFamilies => KnownAgentFamilies;

    public static IReadOnlyList<string> DeserializeSupportedAgentFamilies(string? supportedAgentFamiliesJson, string? modelName)
    {
        if (!string.IsNullOrWhiteSpace(supportedAgentFamiliesJson))
        {
            try
            {
                var families = JsonSerializer.Deserialize<string[]>(supportedAgentFamiliesJson);
                var normalizedFamilies = NormalizeFamilies(families);
                if (normalizedFamilies.Length > 0)
                {
                    return normalizedFamilies;
                }
            }
            catch (JsonException)
            {
                // ignore malformed legacy data and fall back to modelName inference
            }
        }

        var inferredFamily = NormalizeAgentFamily(InferAgentFamily(modelName));
        return inferredFamily is null ? [KnownAgentFamilies[0]] : [inferredFamily];
    }

    public static string SerializeSupportedAgentFamilies(IReadOnlyList<string>? supportedAgentFamilies, string? modelName)
    {
        var normalizedFamilies = NormalizeFamilies(supportedAgentFamilies);
        if (normalizedFamilies.Length == 0)
        {
            var inferredFamily = NormalizeAgentFamily(InferAgentFamily(modelName));
            normalizedFamilies = inferredFamily is null ? [KnownAgentFamilies[0]] : [inferredFamily];
        }

        return JsonSerializer.Serialize(normalizedFamilies);
    }

    public static string GetDefaultAgentFamily(string? modelName)
    {
        var inferredFamily = InferAgentFamily(modelName);
        return NormalizeAgentFamily(inferredFamily) ?? KnownAgentFamilies[0];
    }

    public static string? NormalizeAgentFamily(string? agentFamily)
    {
        if (string.IsNullOrWhiteSpace(agentFamily))
        {
            return null;
        }

        var normalized = agentFamily.Trim().ToLowerInvariant();
        if (normalized.Contains("github copilot", StringComparison.Ordinal)
            || normalized == "copilot-cli"
            || normalized == "copilot cli")
        {
            normalized = "copilot";
        }

        return KnownAgentFamilies.Contains(normalized, StringComparer.Ordinal)
            ? normalized
            : null;
    }

    public static string InferAgentFamily(string? modelName)
    {
        var normalized = modelName?.Trim().ToLowerInvariant() ?? string.Empty;

        if (normalized.Contains("copilot", StringComparison.Ordinal))
        {
            return "copilot";
        }

        if (normalized.Contains("codex", StringComparison.Ordinal))
        {
            return "codex";
        }

        if (normalized.Contains("gemini", StringComparison.Ordinal))
        {
            return "gemini";
        }

        if (normalized.Contains("opencode", StringComparison.Ordinal)
            || normalized.Contains("open code", StringComparison.Ordinal))
        {
            return "opencode";
        }

        return "claude";
    }

    private static string[] NormalizeFamilies(IEnumerable<string?>? families)
    {
        return families?
            .Select(NormalizeAgentFamily)
            .Where(family => !string.IsNullOrWhiteSpace(family))
            .Distinct(StringComparer.Ordinal)
            .Cast<string>()
            .ToArray()
            ?? [];
    }
}
