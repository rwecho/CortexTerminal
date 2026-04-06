using CortexTerminal.Gateway.Models.Audit;

namespace CortexTerminal.Gateway.Contracts.Audit;

public sealed record AuditEntryResponse(
    Guid Id,
    string Category,
    string Kind,
    string Summary,
    string? ActorType,
    string? ActorId,
    string? SessionId,
    string? WorkerId,
    string? TraceId,
    string? PayloadJson,
    DateTime CreatedAtUtc)
{
    public static AuditEntryResponse FromModel(AuditEntryRecord entry)
    {
        return new AuditEntryResponse(
            entry.Id,
            entry.Category,
            entry.Kind,
            entry.Summary,
            entry.ActorType,
            entry.ActorId,
            entry.SessionId,
            entry.WorkerId,
            entry.TraceId,
            entry.PayloadJson,
            entry.CreatedAtUtc);
    }
}
