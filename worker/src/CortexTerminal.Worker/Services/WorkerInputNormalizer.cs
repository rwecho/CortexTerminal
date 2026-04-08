namespace CortexTerminal.Worker.Services;

public static class WorkerInputNormalizer
{
    public static string NormalizeAgentInput(string inbound)
    {
        var knownPrefixes = new[] { "/claude ", "/codex ", "/gemini ", "/opencode ", "/open code " };

        foreach (var prefix in knownPrefixes)
        {
            if (inbound.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && inbound.Length > prefix.Length)
            {
                var prompt = inbound[prefix.Length..].Trim();
                return prompt.Length > 0 ? prompt : inbound;
            }
        }

        return inbound;
    }
}