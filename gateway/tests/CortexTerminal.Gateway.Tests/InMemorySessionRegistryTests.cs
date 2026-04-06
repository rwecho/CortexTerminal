using CortexTerminal.Gateway.Services;

namespace CortexTerminal.Gateway.Tests;

public sealed class InMemorySessionRegistryTests
{
    [Fact]
    public void RegisterWorker_ThenTryGetWorkerConnection_ReturnsConnection()
    {
        var registry = new InMemorySessionRegistry();

        registry.RegisterWorker("worker-1", "conn-worker-1");

        var found = registry.TryGetWorkerConnection("worker-1", out var connectionId);

        Assert.True(found);
        Assert.Equal("conn-worker-1", connectionId);
    }

    [Fact]
    public void RegisterMobileAndBindSession_ThenResolveRouting_ReturnsExpectedTargets()
    {
        var registry = new InMemorySessionRegistry();

        registry.RegisterWorker("worker-1", "conn-worker-1");
        registry.BindSessionToWorker("session-1", "worker-1");
        registry.RegisterMobileSessionConnection("session-1", "conn-mobile-1");

        var hasWorker = registry.TryGetWorkerBySession("session-1", out var workerId);
        var hasWorkerConnection = registry.TryGetWorkerConnection(workerId!, out var workerConnection);
        var hasMobileConnection = registry.TryGetMobileConnectionBySession("session-1", out var mobileConnection);

        Assert.True(hasWorker);
        Assert.True(hasWorkerConnection);
        Assert.True(hasMobileConnection);
        Assert.Equal("worker-1", workerId);
        Assert.Equal("conn-worker-1", workerConnection);
        Assert.Equal("conn-mobile-1", mobileConnection);
    }

    [Fact]
    public void RemoveConnection_WhenWorkerDisconnected_RemovesWorkerAndSessionBinding()
    {
        var registry = new InMemorySessionRegistry();

        registry.RegisterWorker("worker-1", "conn-worker-1");
        registry.BindSessionToWorker("session-1", "worker-1");

        registry.RemoveConnection("conn-worker-1");

        Assert.False(registry.TryGetWorkerConnection("worker-1", out _));
        Assert.False(registry.TryGetWorkerBySession("session-1", out _));
    }

    [Fact]
    public void RemoveConnection_WhenMobileDisconnected_RemovesMobileSessionBindingOnly()
    {
        var registry = new InMemorySessionRegistry();

        registry.RegisterWorker("worker-1", "conn-worker-1");
        registry.BindSessionToWorker("session-1", "worker-1");
        registry.RegisterMobileSessionConnection("session-1", "conn-mobile-1");

        registry.RemoveConnection("conn-mobile-1");

        Assert.True(registry.TryGetWorkerBySession("session-1", out _));
        Assert.False(registry.TryGetMobileConnectionBySession("session-1", out _));
    }
}
