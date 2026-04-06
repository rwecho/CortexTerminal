using CortexTerminal.Gateway.Contracts.Audit;

namespace CortexTerminal.Gateway.Services.Audit;

public interface IAuditTrailService
{
    Task<IReadOnlyList<AuditEntryResponse>> ListAsync(int take, CancellationToken cancellationToken);

    Task WriteAsync(AuditWriteRequest request, CancellationToken cancellationToken);
}

public sealed record AuditWriteRequest(
    string Category,
    string Kind,
    string Summary,
    string? ActorType = null,
    string? ActorId = null,
    string? SessionId = null,
    string? WorkerId = null,
    string? TraceId = null,
    object? Payload = null);
