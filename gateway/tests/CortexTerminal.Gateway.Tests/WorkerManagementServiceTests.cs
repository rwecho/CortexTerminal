using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Workers;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Management;
using CortexTerminal.Gateway.Services.Workers;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Tests;

public sealed class WorkerManagementServiceTests
{
    [Fact]
    public async Task RecordHeartbeatAsync_WithConnectedWorker_RefreshesPresence()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new WorkerManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-1",
            DisplayName = "Worker 1",
            State = WorkerLifecycleState.Online,
            CurrentConnectionId = "conn-1",
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
        });
        await dbContext.SaveChangesAsync();

        await service.RecordHeartbeatAsync("worker-1", CancellationToken.None);

        var worker = await service.GetAsync("worker-1", CancellationToken.None);

        Assert.NotNull(worker);
        Assert.True(worker.IsOnline);
        Assert.Equal(WorkerLifecycleState.Online, worker.LastKnownState);
        Assert.Equal("conn-1", worker.CurrentConnectionId);
        Assert.NotNull(worker.LastHeartbeatAtUtc);

        var presence = await presenceStore.GetWorkerPresenceAsync("worker-1", CancellationToken.None);
        Assert.NotNull(presence);
        Assert.Equal("conn-1", presence.ConnectionId);
        Assert.Equal(0, eventPublisher.WorkersChangedCount);
    }

    [Fact]
    public async Task DeleteOfflineAsync_RemovesWorkerAndUnbindsSessions()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new WorkerManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-offline",
            DisplayName = "Worker Offline",
            State = WorkerLifecycleState.Offline,
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-5),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-5)
        });
        dbContext.Sessions.Add(new CortexTerminal.Gateway.Models.Sessions.GatewaySessionRecord
        {
            SessionId = "session-1",
            WorkerId = "worker-offline",
            DisplayName = "Session 1",
            WorkingDirectory = "/workspace",
            State = CortexTerminal.Gateway.Models.Sessions.SessionLifecycleState.Disconnected,
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-4),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-4)
        });
        await dbContext.SaveChangesAsync();

        var deleted = await service.DeleteOfflineAsync("worker-offline", CancellationToken.None);

        Assert.True(deleted);
        Assert.Null(await dbContext.Workers.FirstOrDefaultAsync(worker => worker.WorkerId == "worker-offline"));

        var session = await dbContext.Sessions.FirstAsync(candidate => candidate.SessionId == "session-1");
        Assert.Null(session.WorkerId);
        Assert.Equal(1, eventPublisher.WorkersChangedCount);
        Assert.Equal(1, eventPublisher.SessionsChangedCount);
    }

    [Fact]
    public async Task GetAsync_WithStaleConnection_ReconcilesWorkerToOffline()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new WorkerManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-stale",
            DisplayName = "Worker Stale",
            State = WorkerLifecycleState.Online,
            CurrentConnectionId = "conn-stale",
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-10),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-10)
        });
        await dbContext.SaveChangesAsync();

        var worker = await service.GetAsync("worker-stale", CancellationToken.None);

        Assert.NotNull(worker);
        Assert.False(worker.IsOnline);
        Assert.Equal(WorkerLifecycleState.Offline, worker.LastKnownState);
        Assert.Null(worker.CurrentConnectionId);
    }

    private static GatewayDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<GatewayDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;

        return new GatewayDbContext(options);
    }

    private sealed class FakeManagementEventPublisher : IManagementEventPublisher
    {
        public int WorkersChangedCount { get; private set; }

        public int SessionsChangedCount { get; private set; }

        public Task PublishWorkersChangedAsync()
        {
            WorkersChangedCount += 1;
            return Task.CompletedTask;
        }

        public Task PublishSessionsChangedAsync()
        {
            SessionsChangedCount += 1;
            return Task.CompletedTask;
        }
    }

    private sealed class FakeAuditTrailService : IAuditTrailService
    {
        public Task<IReadOnlyList<CortexTerminal.Gateway.Contracts.Audit.AuditEntryResponse>> ListAsync(int take, CancellationToken cancellationToken)
        {
            IReadOnlyList<CortexTerminal.Gateway.Contracts.Audit.AuditEntryResponse> entries = [];
            return Task.FromResult(entries);
        }

        public Task WriteAsync(AuditWriteRequest request, CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }
    }

    private sealed class FakeWorkerPresenceStore : IWorkerPresenceStore
    {
        private readonly Dictionary<string, WorkerPresenceSnapshot> workerPresence = new(StringComparer.Ordinal);
        private readonly Dictionary<string, SessionPresenceSnapshot> sessionPresence = new(StringComparer.Ordinal);

        public Task MarkWorkerOnlineAsync(string workerId, string connectionId, CancellationToken cancellationToken)
        {
            workerPresence[workerId] = new WorkerPresenceSnapshot(workerId, connectionId, DateTime.UtcNow);
            return Task.CompletedTask;
        }

        public Task MarkWorkerOfflineAsync(string workerId, CancellationToken cancellationToken)
        {
            workerPresence.Remove(workerId);
            return Task.CompletedTask;
        }

        public Task<WorkerPresenceSnapshot?> GetWorkerPresenceAsync(string workerId, CancellationToken cancellationToken)
        {
            workerPresence.TryGetValue(workerId, out var snapshot);
            return Task.FromResult(snapshot);
        }

        public Task<IReadOnlyDictionary<string, WorkerPresenceSnapshot>> GetWorkerPresenceStatesAsync(IEnumerable<string> workerIds, CancellationToken cancellationToken)
        {
            IReadOnlyDictionary<string, WorkerPresenceSnapshot> snapshots = workerIds
                .Distinct(StringComparer.Ordinal)
                .Where(workerPresence.ContainsKey)
                .ToDictionary(workerId => workerId, workerId => workerPresence[workerId], StringComparer.Ordinal);

            return Task.FromResult(snapshots);
        }

        public Task MarkSessionActiveAsync(string sessionId, string workerId, string mobileConnectionId, string? traceId, CancellationToken cancellationToken)
        {
            sessionPresence[sessionId] = new SessionPresenceSnapshot(sessionId, workerId, mobileConnectionId, traceId, DateTime.UtcNow);
            return Task.CompletedTask;
        }

        public Task TouchSessionAsync(string sessionId, string? traceId, CancellationToken cancellationToken)
        {
            if (sessionPresence.TryGetValue(sessionId, out var snapshot))
            {
                sessionPresence[sessionId] = snapshot with
                {
                    TraceId = traceId ?? snapshot.TraceId,
                    LastSeenUtc = DateTime.UtcNow
                };
            }

            return Task.CompletedTask;
        }

        public Task RemoveSessionAsync(string sessionId, CancellationToken cancellationToken)
        {
            sessionPresence.Remove(sessionId);
            return Task.CompletedTask;
        }

        public Task<SessionPresenceSnapshot?> GetSessionPresenceAsync(string sessionId, CancellationToken cancellationToken)
        {
            sessionPresence.TryGetValue(sessionId, out var snapshot);
            return Task.FromResult(snapshot);
        }

        public Task<IReadOnlyDictionary<string, SessionPresenceSnapshot>> GetSessionPresenceStatesAsync(IEnumerable<string> sessionIds, CancellationToken cancellationToken)
        {
            IReadOnlyDictionary<string, SessionPresenceSnapshot> snapshots = sessionIds
                .Distinct(StringComparer.Ordinal)
                .Where(sessionPresence.ContainsKey)
                .ToDictionary(sessionId => sessionId, sessionId => sessionPresence[sessionId], StringComparer.Ordinal);

            return Task.FromResult(snapshots);
        }
    }
}