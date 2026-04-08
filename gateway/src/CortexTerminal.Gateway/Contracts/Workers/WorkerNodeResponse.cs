using System.Text.Json;
using CortexTerminal.Gateway.Models.Workers;
using CortexTerminal.Gateway.Services.Workers;

namespace CortexTerminal.Gateway.Contracts.Workers;

public sealed record WorkerNodeResponse(
    string WorkerId,
    string DisplayName,
    string? ModelName,
    IReadOnlyList<string> AvailablePaths,
    IReadOnlyList<string> SupportedAgentFamilies,
    WorkerLifecycleState LastKnownState,
    string? CurrentConnectionId,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    DateTime? LastHeartbeatAtUtc,
    bool IsOnline)
{
    public static WorkerNodeResponse FromModel(WorkerNodeRecord worker, bool isOnline)
    {
        return new WorkerNodeResponse(
            worker.WorkerId,
            worker.DisplayName,
            worker.ModelName,
            DeserializePaths(worker.AvailablePathsJson),
            WorkerAgentFamilySupport.DeserializeSupportedAgentFamilies(worker.SupportedAgentFamiliesJson, worker.ModelName),
            worker.State,
            worker.CurrentConnectionId,
            worker.CreatedAtUtc,
            worker.UpdatedAtUtc,
            worker.LastHeartbeatAtUtc,
            isOnline);
    }

    private static IReadOnlyList<string> DeserializePaths(string? availablePathsJson)
    {
        if (string.IsNullOrWhiteSpace(availablePathsJson))
        {
            return [];
        }

        try
        {
            var paths = JsonSerializer.Deserialize<string[]>(availablePathsJson);
            return paths?
                .Where(path => !string.IsNullOrWhiteSpace(path))
                .Distinct(StringComparer.Ordinal)
                .ToArray()
                ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
