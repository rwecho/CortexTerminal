using CortexTerminal.Gateway.Services;

namespace CortexTerminal.Gateway.Tests;

public sealed class InMemorySessionRegistryTests
{
    [Fact]
    public void RemoveConnection_DoesNotDropNewerWorkerMapping()
    {
        var registry = new InMemorySessionRegistry();

        registry.RegisterWorker("worker-1", "old-connection");
        registry.RegisterWorker("worker-1", "new-connection");

        registry.RemoveConnection("old-connection");

        Assert.True(registry.TryGetWorkerConnection("worker-1", out var currentConnectionId));
        Assert.Equal("new-connection", currentConnectionId);
    }
}
