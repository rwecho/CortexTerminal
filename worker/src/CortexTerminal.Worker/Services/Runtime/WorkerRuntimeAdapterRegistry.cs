using CortexTerminal.Worker.Services.Runtime.Adapters;

namespace CortexTerminal.Worker.Services.Runtime;

public static class WorkerRuntimeAdapterRegistry
{
    private static readonly IReadOnlyDictionary<string, IWorkerRuntimeAdapter> Adapters =
        new Dictionary<string, IWorkerRuntimeAdapter>(StringComparer.Ordinal)
        {
            ["claude"] = new ClaudeWorkerRuntimeAdapter(),
            ["copilot"] = new CopilotWorkerRuntimeAdapter(),
            ["codex"] = new CodexWorkerRuntimeAdapter(),
            ["gemini"] = new GeminiWorkerRuntimeAdapter(),
            ["opencode"] = new OpenCodeWorkerRuntimeAdapter(),
        };

    public static IWorkerRuntimeAdapter Resolve(string? requestedAgentFamily, string runtimeCommand)
    {
        var agentFamily = WorkerRuntimeCatalog.ResolveAgentFamily(requestedAgentFamily, runtimeCommand);
        if (Adapters.TryGetValue(agentFamily, out var adapter))
        {
            return adapter;
        }

        throw new InvalidOperationException($"No runtime adapter is registered for agent family '{agentFamily}'.");
    }
}
