namespace CortexTerminal.Gateway.Models.Auth;

public sealed class WorkerDeviceAuthorizationRecord
{
    public Guid Id { get; set; }

    public string DeviceCode { get; set; } = string.Empty;

    public string UserCode { get; set; } = string.Empty;

    public string WorkerId { get; set; } = string.Empty;

    public string WorkerDisplayName { get; set; } = string.Empty;

    public string RequestedScopes { get; set; } = string.Empty;

    public WorkerDeviceAuthorizationStatus Status { get; set; } = WorkerDeviceAuthorizationStatus.Pending;

    public DateTime CreatedAtUtc { get; set; }

    public DateTime ExpiresAtUtc { get; set; }

    public int PollingIntervalSeconds { get; set; }

    public DateTime? ApprovedAtUtc { get; set; }

    public Guid? ApprovedByUserId { get; set; }

    public string? ApprovedByDisplayName { get; set; }

    public DateTime? RedeemedAtUtc { get; set; }

    public DateTime? LastPolledAtUtc { get; set; }
}
