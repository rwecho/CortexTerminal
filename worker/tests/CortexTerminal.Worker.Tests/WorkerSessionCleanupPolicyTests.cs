using CortexTerminal.Worker.Services;
using CortexTerminal.Worker.Services.Sessions;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerSessionCleanupPolicyTests
{
    private static readonly WorkerSessionMaintenanceOptions DefaultOptions = new(
        TimeSpan.FromMinutes(20),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromSeconds(30),
        true);

    [Fact]
    public void Evaluate_WhenSessionIsActiveAndRecent_DoesNothing()
    {
        using var session = CreateSession();
        session.MarkInboundActivity(DateTimeOffset.UtcNow.Subtract(TimeSpan.FromMinutes(5)));

        var snapshot = CreateSnapshot(state: "Active", updatedAtUtc: DateTime.UtcNow);

        var decision = WorkerSessionCleanupPolicy.Evaluate(
            session,
            snapshot,
            DefaultOptions,
            DateTimeOffset.UtcNow);

        Assert.Equal(WorkerSessionCleanupDecision.None, decision);
    }

    [Fact]
    public void Evaluate_WhenIdleTimeoutExceeded_CleansUpAndClosesGatewaySession()
    {
        using var session = CreateSession();
        session.MarkInboundActivity(DateTimeOffset.UtcNow.Subtract(TimeSpan.FromMinutes(25)));

        var snapshot = CreateSnapshot(state: "Active", updatedAtUtc: DateTime.UtcNow);

        var decision = WorkerSessionCleanupPolicy.Evaluate(
            session,
            snapshot,
            DefaultOptions,
            DateTimeOffset.UtcNow);

        Assert.True(decision.ShouldCleanup);
        Assert.True(decision.CloseGatewaySession);
        Assert.Equal("idle-timeout", decision.ReasonCode);
    }

    [Fact]
    public void Evaluate_WhenDisconnectedWithinGrace_DoesNotCleanupEvenIfIdleExceeded()
    {
        using var session = CreateSession();
        session.MarkInboundActivity(DateTimeOffset.UtcNow.Subtract(TimeSpan.FromHours(1)));

        var snapshot = CreateSnapshot(state: "Disconnected", updatedAtUtc: DateTime.UtcNow.AddMinutes(-1));

        var decision = WorkerSessionCleanupPolicy.Evaluate(
            session,
            snapshot,
            DefaultOptions,
            DateTimeOffset.UtcNow);

        Assert.Equal(WorkerSessionCleanupDecision.None, decision);
    }

    [Fact]
    public void Evaluate_WhenDisconnectedGraceExpired_CleansUp()
    {
        using var session = CreateSession();
        var snapshot = CreateSnapshot(state: "Disconnected", updatedAtUtc: DateTime.UtcNow.AddMinutes(-5));

        var decision = WorkerSessionCleanupPolicy.Evaluate(
            session,
            snapshot,
            DefaultOptions,
            DateTimeOffset.UtcNow);

        Assert.True(decision.ShouldCleanup);
        Assert.Equal("reconnect-grace-expired", decision.ReasonCode);
    }

    [Fact]
    public void Evaluate_WhenGatewaySessionMissing_CleansUpWithoutClosingGatewaySession()
    {
        using var session = CreateSession();

        var decision = WorkerSessionCleanupPolicy.Evaluate(
            session,
            null,
            DefaultOptions,
            DateTimeOffset.UtcNow);

        Assert.True(decision.ShouldCleanup);
        Assert.False(decision.CloseGatewaySession);
        Assert.Equal("gateway-session-missing", decision.ReasonCode);
    }

    private static WorkerAgentSession CreateSession()
    {
        return new WorkerAgentSession(
            "session-1",
            "Session 1",
            "/tmp/session-1",
            "claude",
            new FakePtyConnection(),
            new StreamReader(new MemoryStream()),
            new MemoryStream(),
            new StreamWriter(new MemoryStream()),
            new SemaphoreSlim(1, 1));
    }

    private static GatewayManagementClient.GatewaySessionSnapshot CreateSnapshot(string state, DateTime updatedAtUtc)
    {
        return new GatewayManagementClient.GatewaySessionSnapshot(
            "session-1",
            "worker-1",
            "Session 1",
            "claude",
            "/tmp/session-1",
            state,
            "mobile-1",
            "trace-1",
            updatedAtUtc.AddHours(-1),
            updatedAtUtc,
            updatedAtUtc,
            state == "Active");
    }

    private sealed class FakePtyConnection : Pty.Net.IPtyConnection
    {
        public int Pid => 0;

        public int ExitCode => 0;

        public Stream ReaderStream { get; } = new MemoryStream();

        public Stream WriterStream { get; } = new MemoryStream();

        public event EventHandler<Pty.Net.PtyExitedEventArgs>? ProcessExited
        {
            add { }
            remove { }
        }

        public void Dispose()
        {
        }

        public void Kill()
        {
        }

        public void Resize(int cols, int rows)
        {
        }

        public bool WaitForExit(int millisecondsTimeout)
        {
            return true;
        }
    }
}