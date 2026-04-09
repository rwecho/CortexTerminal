using CortexTerminal.Gateway.Contracts.Sessions;
using CortexTerminal.Gateway.Data;
using CortexTerminal.Gateway.Models.Sessions;
using CortexTerminal.Gateway.Models.Workers;
using CortexTerminal.Gateway.Services.Audit;
using CortexTerminal.Gateway.Services.Management;
using CortexTerminal.Gateway.Services.Sessions;
using CortexTerminal.Gateway.Services.Workers;
using Microsoft.EntityFrameworkCore;

namespace CortexTerminal.Gateway.Tests;

public sealed class SessionManagementServiceTests
{
    [Fact]
    public async Task ListAsync_ExcludesClosedSessions()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new SessionManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Sessions.AddRange(
            new GatewaySessionRecord
            {
                SessionId = "session-open",
                DisplayName = "Open Session",
                WorkingDirectory = "/workspace/open",
                State = SessionLifecycleState.Created,
                CreatedAtUtc = DateTime.UtcNow.AddMinutes(-2),
                UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-2)
            },
            new GatewaySessionRecord
            {
                SessionId = "session-closed",
                DisplayName = "Closed Session",
                WorkingDirectory = "/workspace/closed",
                State = SessionLifecycleState.Closed,
                CreatedAtUtc = DateTime.UtcNow.AddMinutes(-1),
                UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-1)
            });

        await dbContext.SaveChangesAsync();

        var sessions = await service.ListAsync(CancellationToken.None);

        Assert.Single(sessions);
        Assert.Equal("session-open", sessions[0].SessionId);
    }

    [Fact]
    public async Task CreateAsync_WithOfflineWorker_ThrowsClearError()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new SessionManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-offline",
            DisplayName = "Worker Offline",
            State = WorkerLifecycleState.Offline,
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-3),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-3)
        });
        await dbContext.SaveChangesAsync();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateAsync(
                new CreateGatewaySessionRequest(
                    null,
                    null,
                    "worker-offline",
                    "Offline Session",
                    "claude",
                    "/workspace/offline",
                    null),
                CancellationToken.None));

        Assert.Contains("offline", exception.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_WithExpiredPresence_ThrowsOfflineErrorAndClearsPresence()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new SessionManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-stale",
            DisplayName = "Worker Stale",
            State = WorkerLifecycleState.Online,
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-3),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-3)
        });
        await dbContext.SaveChangesAsync();

        presenceStore.SetWorkerPresence(
            "worker-stale",
            "conn-stale",
            DateTime.UtcNow - WorkerPresencePolicy.MaxWorkerSilence - TimeSpan.FromSeconds(5));

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.CreateAsync(
                new CreateGatewaySessionRequest(
                    null,
                    null,
                    "worker-stale",
                    "Stale Session",
                    "claude",
                    "/workspace/stale",
                    null),
                CancellationToken.None));

        Assert.Contains("offline", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Null(await presenceStore.GetWorkerPresenceAsync("worker-stale", CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WithUndetectedAgentFamily_StillAllowsSessionCreation()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new SessionManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-online",
            DisplayName = "Worker Online",
            ModelName = "Claude CLI",
            SupportedAgentFamiliesJson = "[\"claude\",\"opencode\"]",
            State = WorkerLifecycleState.Online,
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-3),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-3)
        });
        await dbContext.SaveChangesAsync();
        await presenceStore.MarkWorkerOnlineAsync("worker-online", "conn-1", CancellationToken.None);

        var session = await service.CreateAsync(
            new CreateGatewaySessionRequest(
                null,
                null,
                "worker-online",
                "Codex Session",
                "codex",
                "/workspace/runtime",
                null),
            CancellationToken.None);

        Assert.Equal("codex", session.AgentFamily);
    }

    [Fact]
    public async Task CreateAsync_WithSupportedAgentFamily_PersistsSelectedRuntime()
    {
        await using var dbContext = CreateDbContext();
        var presenceStore = new FakeWorkerPresenceStore();
        var auditTrailService = new FakeAuditTrailService();
        var eventPublisher = new FakeManagementEventPublisher();
        var service = new SessionManagementService(dbContext, presenceStore, auditTrailService, eventPublisher);

        dbContext.Workers.Add(new WorkerNodeRecord
        {
            WorkerId = "worker-online",
            DisplayName = "Worker Online",
            ModelName = "Claude CLI",
            SupportedAgentFamiliesJson = "[\"claude\",\"codex\"]",
            State = WorkerLifecycleState.Online,
            CreatedAtUtc = DateTime.UtcNow.AddMinutes(-3),
            UpdatedAtUtc = DateTime.UtcNow.AddMinutes(-3)
        });
        await dbContext.SaveChangesAsync();
        await presenceStore.MarkWorkerOnlineAsync("worker-online", "conn-1", CancellationToken.None);

        var session = await service.CreateAsync(
            new CreateGatewaySessionRequest(
                null,
                null,
                "worker-online",
                "Codex Session",
                "codex",
                "/workspace/runtime",
                "trace-123"),
            CancellationToken.None);

        Assert.Equal("codex", session.AgentFamily);

        var storedSession = await dbContext.Sessions.SingleAsync(candidate => candidate.SessionId == session.SessionId);
        Assert.Equal("codex", storedSession.AgentFamily);
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
        public Task PublishWorkersChangedAsync() => Task.CompletedTask;

        public Task PublishSessionsChangedAsync() => Task.CompletedTask;
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

        public void SetWorkerPresence(string workerId, string connectionId, DateTime lastSeenUtc)
        {
            workerPresence[workerId] = new WorkerPresenceSnapshot(workerId, connectionId, lastSeenUtc);
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
