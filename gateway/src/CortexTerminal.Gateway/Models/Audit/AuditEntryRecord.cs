namespace CortexTerminal.Gateway.Models.Audit;

public sealed class AuditEntryRecord
{
    public Guid Id { get; set; }

    public string Category { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string? ActorType { get; set; }

    public string? ActorId { get; set; }

    public string? SessionId { get; set; }

    public string? WorkerId { get; set; }

    public string? TraceId { get; set; }

    public string? PayloadJson { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}
