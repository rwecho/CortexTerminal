namespace CortexTerminal.Gateway.Models.Sessions;

public sealed class GatewaySessionRecord
{
    public string SessionId { get; set; } = string.Empty;

    public Guid? UserId { get; set; }

    public string? WorkerId { get; set; }

    public string? DisplayName { get; set; }

    public string? WorkingDirectory { get; set; }

    public SessionLifecycleState State { get; set; } = SessionLifecycleState.Created;

    public string? MobileConnectionId { get; set; }

    public string? TraceId { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public DateTime? LastActivityAtUtc { get; set; }
}
