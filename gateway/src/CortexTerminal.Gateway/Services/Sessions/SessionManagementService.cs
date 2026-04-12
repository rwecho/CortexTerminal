using CortexTerminal.Gateway.Contracts.Sessions;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Sessions;
using CortexTerminal.Gateway.Models.Workers;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Management;
using CortexTerminal.Gateway.Services.Workers;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Services.Sessions;

public sealed class SessionManagementService(
    GatewayDbContext dbContext,
    IWorkerPresenceStore workerPresenceStore,
    IAuditTrailService auditTrailService,
    IManagementEventPublisher managementEventPublisher) : ISessionManagementService
{
    public async Task<IReadOnlyList<GatewaySessionResponse>> ListAsync(CancellationToken cancellationToken)
    {
        var sessions = await dbContext.Sessions
            .Where(session => session.State != SessionLifecycleState.Closed)
            .OrderByDescending(session => session.UpdatedAtUtc)
            .ToListAsync(cancellationToken);

        var presence = await workerPresenceStore.GetSessionPresenceStatesAsync(
            sessions.Select(session => session.SessionId),
            cancellationToken);

        return sessions
            .Select(session => GatewaySessionResponse.FromModel(session, presence.ContainsKey(session.SessionId)))
            .ToList();
    }

    public async Task<GatewaySessionResponse?> GetAsync(string sessionId, CancellationToken cancellationToken)
    {
        var session = await dbContext.Sessions.FirstOrDefaultAsync(candidate => candidate.SessionId == sessionId, cancellationToken);
        if (session is null)
        {
            return null;
        }

        var presence = await workerPresenceStore.GetSessionPresenceAsync(sessionId, cancellationToken);
        return GatewaySessionResponse.FromModel(session, presence is not null);
    }

    public async Task<GatewaySessionResponse> CreateAsync(CreateGatewaySessionRequest request, CancellationToken cancellationToken)
    {
        if (request.UserId.HasValue)
        {
            var userExists = await dbContext.Users.AnyAsync(user => user.Id == request.UserId.Value, cancellationToken);
            if (!userExists)
            {
                throw new InvalidOperationException($"User '{request.UserId}' does not exist.");
            }
        }

        if (!string.IsNullOrWhiteSpace(request.WorkerId))
        {
            var normalizedWorkerId = request.WorkerId.Trim();
            await EnsureWorkerExistsAsync(normalizedWorkerId, cancellationToken);

            var workerPresence = await workerPresenceStore.GetWorkerPresenceAsync(normalizedWorkerId, cancellationToken);
            if (!WorkerPresencePolicy.IsWorkerOnline(workerPresence, DateTime.UtcNow))
            {
                if (workerPresence is not null)
                {
                    await workerPresenceStore.MarkWorkerOfflineAsync(normalizedWorkerId, cancellationToken);
                }

                throw new InvalidOperationException($"Worker '{normalizedWorkerId}' 当前离线，无法创建会话。请先恢复节点连接。\nWorker '{normalizedWorkerId}' is offline and cannot accept new sessions.");
            }

            var worker = await dbContext.Workers.FirstAsync(candidate => candidate.WorkerId == normalizedWorkerId, cancellationToken);
            var normalizedAgentFamily = WorkerAgentFamilySupport.NormalizeAgentFamily(request.AgentFamily)
                ?? WorkerAgentFamilySupport.GetDefaultAgentFamily(worker.ModelName);
            EnsureWorkerSupportsAgentFamily(worker, normalizedAgentFamily);

            request = request with { AgentFamily = normalizedAgentFamily };
        }

        var normalizedWorkingDirectory = string.IsNullOrWhiteSpace(request.WorkingDirectory)
            ? null
            : request.WorkingDirectory;

        if (string.IsNullOrWhiteSpace(normalizedWorkingDirectory))
        {
            throw new InvalidOperationException("WorkingDirectory is required.");
        }

        var sessionId = string.IsNullOrWhiteSpace(request.SessionId)
            ? $"session-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
            : request.SessionId.Trim();

        if (await dbContext.Sessions.AnyAsync(session => session.SessionId == sessionId, cancellationToken))
        {
            throw new InvalidOperationException($"Session '{sessionId}' already exists.");
        }

        var utcNow = DateTime.UtcNow;
        var session = new GatewaySessionRecord
        {
            SessionId = sessionId,
            UserId = request.UserId,
            WorkerId = string.IsNullOrWhiteSpace(request.WorkerId) ? null : request.WorkerId.Trim(),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? sessionId : request.DisplayName.Trim(),
            AgentFamily = string.IsNullOrWhiteSpace(request.AgentFamily) ? null : request.AgentFamily.Trim(),
            WorkingDirectory = normalizedWorkingDirectory,
            TraceId = string.IsNullOrWhiteSpace(request.TraceId) ? null : request.TraceId.Trim(),
            State = SessionLifecycleState.Created,
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow,
            LastActivityAtUtc = utcNow
        };

        dbContext.Sessions.Add(session);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "session",
                "created",
                $"会话 {session.DisplayName} 已创建。",
                ActorType: "user",
                ActorId: request.UserId?.ToString(),
                SessionId: session.SessionId,
                WorkerId: session.WorkerId,
                TraceId: session.TraceId,
                Payload: new { session.WorkingDirectory, session.AgentFamily, session.State }),
            cancellationToken);
        await managementEventPublisher.PublishSessionsChangedAsync();

        return GatewaySessionResponse.FromModel(session, false);
    }

    public async Task<GatewaySessionResponse?> BindSessionAsync(string sessionId, BindGatewaySessionRequest request, CancellationToken cancellationToken)
    {
        var session = await dbContext.Sessions.FirstOrDefaultAsync(candidate => candidate.SessionId == sessionId, cancellationToken);
        if (session is null)
        {
            return null;
        }

        var normalizedWorkerId = request.WorkerId.Trim();
        await EnsureWorkerExistsAsync(normalizedWorkerId, cancellationToken);

        var workerPresence = await workerPresenceStore.GetWorkerPresenceAsync(normalizedWorkerId, cancellationToken);
        if (!WorkerPresencePolicy.IsWorkerOnline(workerPresence, DateTime.UtcNow))
        {
            if (workerPresence is not null)
            {
                await workerPresenceStore.MarkWorkerOfflineAsync(normalizedWorkerId, cancellationToken);
            }

            throw new InvalidOperationException($"Worker '{normalizedWorkerId}' 当前离线，无法重新绑定会话。\nWorker '{normalizedWorkerId}' is offline and cannot be bound.");
        }

        var worker = await dbContext.Workers.FirstAsync(candidate => candidate.WorkerId == normalizedWorkerId, cancellationToken);
        var normalizedAgentFamily = WorkerAgentFamilySupport.NormalizeAgentFamily(session.AgentFamily)
            ?? WorkerAgentFamilySupport.GetDefaultAgentFamily(worker.ModelName);
        EnsureWorkerSupportsAgentFamily(worker, normalizedAgentFamily);

        session.WorkerId = normalizedWorkerId;
        session.AgentFamily = normalizedAgentFamily;
        session.TraceId = string.IsNullOrWhiteSpace(request.TraceId) ? session.TraceId : request.TraceId.Trim();
        session.UpdatedAtUtc = DateTime.UtcNow;
        if (session.State == SessionLifecycleState.Closed)
        {
            session.State = SessionLifecycleState.Created;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "session",
                "bound",
                $"会话 {session.DisplayName ?? session.SessionId} 已绑定到节点 {session.WorkerId}。",
                ActorType: "system",
                SessionId: session.SessionId,
                WorkerId: session.WorkerId,
                TraceId: session.TraceId,
                Payload: new { session.State }),
            cancellationToken);
        await managementEventPublisher.PublishSessionsChangedAsync();

        var presence = await workerPresenceStore.GetSessionPresenceAsync(sessionId, cancellationToken);
        return GatewaySessionResponse.FromModel(session, presence is not null);
    }

    public async Task ActivateBindingAsync(string sessionId, string workerId, string mobileConnectionId, CancellationToken cancellationToken)
    {
        await EnsureWorkerExistsAsync(workerId, cancellationToken);

        var utcNow = DateTime.UtcNow;
        var session = await dbContext.Sessions.FirstOrDefaultAsync(candidate => candidate.SessionId == sessionId, cancellationToken);
        if (session is null)
        {
            session = new GatewaySessionRecord
            {
                SessionId = sessionId,
                CreatedAtUtc = utcNow
            };
            dbContext.Sessions.Add(session);
        }

        session.WorkerId = workerId;
        session.MobileConnectionId = mobileConnectionId;
        session.State = SessionLifecycleState.Active;
        session.UpdatedAtUtc = utcNow;
        session.LastActivityAtUtc = utcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await workerPresenceStore.MarkSessionActiveAsync(sessionId, workerId, mobileConnectionId, session.TraceId, cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "session",
                "activated",
                $"会话 {session.DisplayName ?? session.SessionId} 已激活。",
                ActorType: "system",
                SessionId: session.SessionId,
                WorkerId: session.WorkerId,
                TraceId: session.TraceId,
                Payload: new { session.MobileConnectionId, session.State }),
            cancellationToken);
        await managementEventPublisher.PublishSessionsChangedAsync();
    }

    public async Task TouchAsync(string sessionId, string? traceId, CancellationToken cancellationToken)
    {
        var session = await dbContext.Sessions.FirstOrDefaultAsync(candidate => candidate.SessionId == sessionId, cancellationToken);
        if (session is null)
        {
            return;
        }

        session.LastActivityAtUtc = DateTime.UtcNow;
        session.UpdatedAtUtc = session.LastActivityAtUtc.Value;
        if (!string.IsNullOrWhiteSpace(traceId))
        {
            session.TraceId = traceId.Trim();
        }

        if (session.State != SessionLifecycleState.Closed)
        {
            session.State = SessionLifecycleState.Active;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await workerPresenceStore.TouchSessionAsync(sessionId, traceId, cancellationToken);
    }

    public async Task MarkDisconnectedByConnectionAsync(string connectionId, CancellationToken cancellationToken)
    {
        var sessions = await dbContext.Sessions
            .Where(session => session.MobileConnectionId == connectionId)
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0)
        {
            return;
        }

        var utcNow = DateTime.UtcNow;
        foreach (var session in sessions)
        {
            session.MobileConnectionId = null;
            if (session.State != SessionLifecycleState.Closed)
            {
                session.State = SessionLifecycleState.Disconnected;
            }

            session.UpdatedAtUtc = utcNow;
            await workerPresenceStore.RemoveSessionAsync(session.SessionId, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        foreach (var session in sessions)
        {
            await auditTrailService.WriteAsync(
                new AuditWriteRequest(
                    "session",
                    "disconnected",
                    $"会话 {session.DisplayName ?? session.SessionId} 已断开移动端连接。",
                    ActorType: "system",
                    SessionId: session.SessionId,
                    WorkerId: session.WorkerId,
                    TraceId: session.TraceId),
                cancellationToken);
        }
        await managementEventPublisher.PublishSessionsChangedAsync();
    }

    public async Task<GatewaySessionResponse?> CloseAsync(string sessionId, string actorType, string? actorId, CancellationToken cancellationToken)
    {
        var session = await dbContext.Sessions.FirstOrDefaultAsync(candidate => candidate.SessionId == sessionId, cancellationToken);
        if (session is null)
        {
            return null;
        }

        session.State = SessionLifecycleState.Closed;
        session.MobileConnectionId = null;
        session.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await workerPresenceStore.RemoveSessionAsync(sessionId, cancellationToken);
        await auditTrailService.WriteAsync(
            new AuditWriteRequest(
                "session",
                "closed",
                $"会话 {session.DisplayName ?? session.SessionId} 已关闭。",
                ActorType: actorType,
                ActorId: actorId,
                SessionId: session.SessionId,
                WorkerId: session.WorkerId,
                TraceId: session.TraceId),
            cancellationToken);
        await managementEventPublisher.PublishSessionsChangedAsync();

        return GatewaySessionResponse.FromModel(session, false);
    }

    private async Task EnsureWorkerExistsAsync(string workerId, CancellationToken cancellationToken)
    {
        var workerExists = await dbContext.Workers.AnyAsync(worker => worker.WorkerId == workerId, cancellationToken);
        if (workerExists)
        {
            return;
        }

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = workerId,
            DisplayName = workerId,
            State = WorkerLifecycleState.Unknown,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void EnsureWorkerSupportsAgentFamily(WorkerNodeRecord worker, string agentFamily)
    {
        var supportedAgentFamilies = WorkerAgentFamilySupport.DeserializeSupportedAgentFamilies(
            worker.SupportedAgentFamiliesJson,
            worker.ModelName);

        if (supportedAgentFamilies.Contains(agentFamily, StringComparer.Ordinal))
        {
            return;
        }

        throw new InvalidOperationException(
            $"Worker '{worker.WorkerId}' 不支持 runtime '{agentFamily}'。当前节点支持：{string.Join(", ", supportedAgentFamilies)}。");
    }
}
