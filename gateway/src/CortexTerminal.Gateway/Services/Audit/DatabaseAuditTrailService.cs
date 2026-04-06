using System.Text.Json;
using CortexTerminal.Gateway.Contracts.Audit;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Audit;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Services.Audit;

public sealed class DatabaseAuditTrailService(GatewayDbContext dbContext) : IAuditTrailService
{
    public async Task<IReadOnlyList<AuditEntryResponse>> ListAsync(int take, CancellationToken cancellationToken)
    {
        var normalizedTake = Math.Clamp(take, 1, 200);
        var entries = await dbContext.AuditEntries
            .OrderByDescending(entry => entry.CreatedAtUtc)
            .Take(normalizedTake)
            .ToListAsync(cancellationToken);

        return entries.Select(AuditEntryResponse.FromModel).ToList();
    }

    public async Task WriteAsync(AuditWriteRequest request, CancellationToken cancellationToken)
    {
        var entry = new AuditEntryRecord
        {
            Id = Guid.NewGuid(),
            Category = request.Category.Trim(),
            Kind = request.Kind.Trim(),
            Summary = request.Summary.Trim(),
            ActorType = string.IsNullOrWhiteSpace(request.ActorType) ? null : request.ActorType.Trim(),
            ActorId = string.IsNullOrWhiteSpace(request.ActorId) ? null : request.ActorId.Trim(),
            SessionId = string.IsNullOrWhiteSpace(request.SessionId) ? null : request.SessionId.Trim(),
            WorkerId = string.IsNullOrWhiteSpace(request.WorkerId) ? null : request.WorkerId.Trim(),
            TraceId = string.IsNullOrWhiteSpace(request.TraceId) ? null : request.TraceId.Trim(),
            PayloadJson = request.Payload is null ? null : JsonSerializer.Serialize(request.Payload),
            CreatedAtUtc = DateTime.UtcNow,
        };

        dbContext.AuditEntries.Add(entry);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
