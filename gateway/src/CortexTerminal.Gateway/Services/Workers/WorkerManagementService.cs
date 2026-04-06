using System.Text.Json;
using CortexTerminal.Gateway.Contracts.Workers;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Sessions;
using CortexTerminal.Gateway.Models.Workers;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Management;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Services.Workers;

public sealed class WorkerManagementService(
    GatewayDbContext dbContext,
    IWorkerPresenceStore workerPresenceStore,
    IAuditTrailService auditTrailService,
    IManagementEventPublisher managementEventPublisher) : IWorkerManagementService
{
    public async Task<IReadOnlyList<WorkerNodeResponse>> ListAsync(CancellationToken cancellationToken)
    {
        var workers = await dbContext.Workers
            .OrderBy(worker => worker.WorkerId)
            .ToListAsync(cancellationToken);

        var presence = await workerPresenceStore.GetWorkerPresenceStatesAsync(
            workers.Select(worker => worker.WorkerId),
            cancellationToken);

        await NormalizeOfflineWorkersAsync(workers, presence, cancellationToken);

        return workers
            .Select(worker => WorkerNodeResponse.FromModel(worker, presence.ContainsKey(worker.WorkerId)))
            .ToList();
    }

    public async Task<WorkerNodeResponse?> GetAsync(string workerId, CancellationToken cancellationToken)
    {
        var worker = await dbContext.Workers.FirstOrDefaultAsync(candidate => candidate.WorkerId == workerId, cancellationToken);
        if (worker is null)
        {
            return null;
        }

        var presence = await workerPresenceStore.GetWorkerPresenceAsync(workerId, cancellationToken);
        await NormalizeOfflineWorkersAsync([worker], presence is null
            ? new Dictionary<string, WorkerPresenceSnapshot>()
            : new Dictionary<string, WorkerPresenceSnapshot> { [workerId] = presence }, cancellationToken);
        return WorkerNodeResponse.FromModel(worker, presence is not null);
    }

    public async Task<bool> DeleteOfflineAsync(string workerId, CancellationToken cancellationToken)
    {
        var normalizedWorkerId = workerId.Trim();
        if (string.IsNullOrWhiteSpace(normalizedWorkerId))
        {
            throw new InvalidOperationException("WorkerId is required.");
        }

        var worker = await dbContext.Workers.FirstOrDefaultAsync(candidate => candidate.WorkerId == normalizedWorkerId, cancellationToken);
        if (worker is null)
        {
            return false;
        }

        var presence = await workerPresenceStore.GetWorkerPresenceAsync(normalizedWorkerId, cancellationToken);
        if (presence is not null)
        {
            throw new InvalidOperationException($"Worker '{normalizedWorkerId}' is still online and cannot be removed.");
        }

        var utcNow = DateTime.UtcNow;
        var relatedSessions = await dbContext.Sessions
            .Where(session => session.WorkerId == normalizedWorkerId)
            .ToListAsync(cancellationToken);

        foreach (var session in relatedSessions)
        {
            session.WorkerId = null;
            session.MobileConnectionId = null;
            if (session.State == SessionLifecycleState.Active)
            {
                session.State = SessionLifecycleState.Disconnected;
                await workerPresenceStore.RemoveSessionAsync(session.SessionId, cancellationToken);
            }

            session.UpdatedAtUtc = utcNow;
        }

        dbContext.Workers.Remove(worker);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "worker",
                "deleted",
                $"离线节点 {worker.DisplayName} 已被清理。",
                ActorType: "user",
                ActorId: worker.WorkerId,
                WorkerId: worker.WorkerId,
                Payload: new { affectedSessions = relatedSessions.Select(session => session.SessionId).ToArray() }),
            cancellationToken);
        await managementEventPublisher.PublishWorkersChangedAsync();
        await managementEventPublisher.PublishSessionsChangedAsync();

        return true;
    }

    public async Task<WorkerNodeResponse> UpsertAsync(UpsertWorkerRequest request, CancellationToken cancellationToken)
    {
        var workerId = request.WorkerId.Trim();
        if (string.IsNullOrWhiteSpace(workerId))
        {
            throw new InvalidOperationException("WorkerId is required.");
        }

        var worker = await EnsureWorkerAsync(workerId, cancellationToken);
        worker.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? workerId : request.DisplayName.Trim();
        worker.ModelName = string.IsNullOrWhiteSpace(request.ModelName) ? worker.ModelName : request.ModelName.Trim();
        worker.AvailablePathsJson = SerializePaths(request.AvailablePaths);
        worker.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "worker",
                "upserted",
                $"节点 {worker.DisplayName} 已更新注册信息。",
                ActorType: "worker",
                ActorId: worker.WorkerId,
                WorkerId: worker.WorkerId,
                Payload: new { worker.ModelName, request.AvailablePaths }),
            cancellationToken);
        await managementEventPublisher.PublishWorkersChangedAsync();

        var presence = await workerPresenceStore.GetWorkerPresenceAsync(worker.WorkerId, cancellationToken);
        return WorkerNodeResponse.FromModel(worker, presence is not null);
    }

    public async Task RegisterConnectionAsync(string workerId, string connectionId, CancellationToken cancellationToken)
    {
        var worker = await EnsureWorkerAsync(workerId, cancellationToken);
        var utcNow = DateTime.UtcNow;
        worker.DisplayName = string.IsNullOrWhiteSpace(worker.DisplayName) ? workerId : worker.DisplayName;
        worker.State = WorkerLifecycleState.Online;
        worker.CurrentConnectionId = connectionId;
        worker.LastHeartbeatAtUtc = utcNow;
        worker.UpdatedAtUtc = utcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await workerPresenceStore.MarkWorkerOnlineAsync(workerId, connectionId, cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "worker",
                "connected",
                $"节点 {worker.DisplayName} 已上线。",
                ActorType: "worker",
                ActorId: worker.WorkerId,
                WorkerId: worker.WorkerId,
                Payload: new { worker.CurrentConnectionId }),
            cancellationToken);
        await managementEventPublisher.PublishWorkersChangedAsync();
    }

    public async Task MarkDisconnectedByConnectionAsync(string connectionId, CancellationToken cancellationToken)
    {
        var disconnectedWorkers = await dbContext.Workers
            .Where(worker => worker.CurrentConnectionId == connectionId)
            .ToListAsync(cancellationToken);

        if (disconnectedWorkers.Count == 0)
        {
            return;
        }

        var utcNow = DateTime.UtcNow;

        foreach (var worker in disconnectedWorkers)
        {
            worker.State = WorkerLifecycleState.Offline;
            worker.CurrentConnectionId = null;
            worker.UpdatedAtUtc = utcNow;
            await workerPresenceStore.MarkWorkerOfflineAsync(worker.WorkerId, cancellationToken);

            var sessions = await dbContext.Sessions
                .Where(session => session.WorkerId == worker.WorkerId && session.State == SessionLifecycleState.Active)
                .ToListAsync(cancellationToken);

            foreach (var session in sessions)
            {
                session.State = SessionLifecycleState.Disconnected;
                session.UpdatedAtUtc = utcNow;
                await workerPresenceStore.RemoveSessionAsync(session.SessionId, cancellationToken);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        foreach (var worker in disconnectedWorkers)
        {
            await auditTrailService.WriteAsync(
                new AuditWriteRequest(
                    "worker",
                    "disconnected",
                    $"节点 {worker.DisplayName} 已离线。",
                    ActorType: "worker",
                    ActorId: worker.WorkerId,
                    WorkerId: worker.WorkerId),
                cancellationToken);
        }
        await managementEventPublisher.PublishWorkersChangedAsync();
        await managementEventPublisher.PublishSessionsChangedAsync();
    }

    public async Task RecordHeartbeatAsync(string workerId, CancellationToken cancellationToken)
    {
        var worker = await EnsureWorkerAsync(workerId, cancellationToken);
        var utcNow = DateTime.UtcNow;
        worker.LastHeartbeatAtUtc = utcNow;
        worker.UpdatedAtUtc = utcNow;

        if (!string.IsNullOrWhiteSpace(worker.CurrentConnectionId))
        {
            worker.State = WorkerLifecycleState.Online;
        }

        if (worker.State == WorkerLifecycleState.Unknown)
        {
            worker.State = WorkerLifecycleState.Offline;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(worker.CurrentConnectionId))
        {
            await workerPresenceStore.MarkWorkerOnlineAsync(workerId, worker.CurrentConnectionId, cancellationToken);
        }
    }

    private static string SerializePaths(IReadOnlyList<string>? availablePaths)
    {
        var normalizedPaths = availablePaths?
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(path => path.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return JsonSerializer.Serialize(normalizedPaths ?? []);
    }

    private async Task NormalizeOfflineWorkersAsync(
        IReadOnlyList<WorkerNodeRecord> workers,
        IReadOnlyDictionary<string, WorkerPresenceSnapshot> presence,
        CancellationToken cancellationToken)
    {
        var staleWorkers = workers
            .Where(worker => !presence.ContainsKey(worker.WorkerId)
                && (worker.State == WorkerLifecycleState.Online
                    || !string.IsNullOrWhiteSpace(worker.CurrentConnectionId)))
            .ToList();

        if (staleWorkers.Count == 0)
        {
            return;
        }

        var utcNow = DateTime.UtcNow;
        foreach (var worker in staleWorkers)
        {
            worker.State = WorkerLifecycleState.Offline;
            worker.CurrentConnectionId = null;
            worker.UpdatedAtUtc = utcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<WorkerNodeRecord> EnsureWorkerAsync(string workerId, CancellationToken cancellationToken)
    {
        var worker = await dbContext.Workers.FirstOrDefaultAsync(candidate => candidate.WorkerId == workerId, cancellationToken);
        if (worker is not null)
        {
            return worker;
        }

        worker = new WorkerNodeRecord
        {
            WorkerId = workerId,
            DisplayName = workerId,
            State = WorkerLifecycleState.Unknown,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        dbContext.Workers.Add(worker);
        await dbContext.SaveChangesAsync(cancellationToken);
        return worker;
    }
}
