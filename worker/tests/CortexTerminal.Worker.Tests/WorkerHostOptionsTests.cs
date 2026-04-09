using CortexTerminal.Worker.Services;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.Extensions.Logging;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerHostOptionsTests
{
    [Fact]
    public void LoadFromEnvironment_UsesBuiltInOperationalDefaults()
    {
        using var scope = new EnvironmentVariableScope(new Dictionary<string, string?>
        {
            ["WORKER_ID"] = "worker-defaults"
        });

        var options = WorkerHostOptions.LoadFromEnvironment();

        Assert.Equal(
            HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
            options.WorkerHubTransport);
        Assert.Equal(TimeSpan.FromSeconds(5), options.WorkerHeartbeatInterval);
        Assert.Equal(TimeSpan.FromMinutes(20), options.WorkerSessionMaintenance.IdleTimeout);
        Assert.Equal(TimeSpan.FromMinutes(2), options.WorkerSessionMaintenance.DisconnectedGracePeriod);
        Assert.Equal(TimeSpan.FromSeconds(30), options.WorkerSessionMaintenance.SweepInterval);
        Assert.True(options.WorkerSessionMaintenance.CloseGatewaySessionOnCleanup);
        Assert.Equal("worker-defaults", options.WorkerDisplayName);
        Assert.Empty(options.WorkerAvailablePaths);
    }

    [Fact]
    public void LoadFromEnvironment_ParsesEssentialDeploymentConfiguration()
    {
        using var scope = new EnvironmentVariableScope(new Dictionary<string, string?>
        {
            ["WORKER_ID"] = "worker-custom",
            ["GATEWAY_BASE_URL"] = "https://gateway.example.com",
            ["WORKER_SUPPORTED_AGENT_FAMILIES"] = "codex,claude",
            ["WORKER_LOG_LEVEL"] = "Debug"
        });

        var options = WorkerHostOptions.LoadFromEnvironment();

        Assert.Equal("worker-custom", options.WorkerId);
        Assert.Equal("https://gateway.example.com", options.GatewayBaseUrl);
        Assert.Equal("worker-custom", options.WorkerDisplayName);
        Assert.Equal("Multi-runtime worker (codex, claude)", options.WorkerModelName);
        Assert.Equal("codex", options.WorkerRuntimeCommand);
        Assert.Equal(LogLevel.Debug, options.WorkerLogLevel);
        Assert.Equal(["codex", "claude"], options.WorkerSupportedAgentFamilies);
        Assert.Empty(options.WorkerAvailablePaths);
    }

    private sealed class EnvironmentVariableScope : IDisposable
    {
        private readonly Dictionary<string, string?> originalValues = new(StringComparer.Ordinal);

        public EnvironmentVariableScope(IReadOnlyDictionary<string, string?> variables)
        {
            foreach (var pair in variables)
            {
                originalValues[pair.Key] = Environment.GetEnvironmentVariable(pair.Key);
                Environment.SetEnvironmentVariable(pair.Key, pair.Value);
            }
        }

        public void Dispose()
        {
            foreach (var pair in originalValues)
            {
                Environment.SetEnvironmentVariable(pair.Key, pair.Value);
            }
        }
    }
}
