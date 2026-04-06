namespace CortexTerminal.Gateway.Models.Workers;

public sealed class WorkerNodeRecord
{
    public string WorkerId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? ModelName { get; set; }

    public string? AvailablePathsJson { get; set; }

    public WorkerLifecycleState State { get; set; } = WorkerLifecycleState.Unknown;

    public string? CurrentConnectionId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public DateTime? LastHeartbeatAtUtc { get; set; }
}
