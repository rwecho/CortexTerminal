using Microsoft.Extensions.Logging;
using CortexTerminal.Worker.Services.Sessions;
using Microsoft.AspNetCore.Http.Connections;

namespace CortexTerminal.Worker.Services;

public sealed record WorkerHostOptions(
    string WorkerId,
    string GatewayBaseUrl,
    string WorkerDisplayName,
    string WorkerModelName,
    string WorkerRuntimeCommand,
    IReadOnlyList<string> WorkerSupportedAgentFamilies,
    IReadOnlyList<string> WorkerAvailablePaths,
    string WorkerTokenCachePath,
    string? WorkerUserKey,
    string HubUrl,
    HttpTransportType WorkerHubTransport,
    LogLevel WorkerLogLevel,
    TimeSpan WorkerHeartbeatInterval,
    WorkerSessionMaintenanceOptions WorkerSessionMaintenance)
{
    private static readonly HttpTransportType DefaultWorkerHubTransport = HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling;
    private static readonly TimeSpan DefaultWorkerHeartbeatInterval = TimeSpan.FromSeconds(5);
    private static readonly WorkerSessionMaintenanceOptions DefaultWorkerSessionMaintenance = new(
        TimeSpan.FromMinutes(20),
        TimeSpan.FromMinutes(2),
        TimeSpan.FromSeconds(30),
        true);

    public static WorkerHostOptions LoadFromEnvironment()
    {
        var workerId = ResolveWorkerId(Environment.GetEnvironmentVariable("WORKER_ID"));
        var gatewayBaseUrl = Environment.GetEnvironmentVariable("GATEWAY_BASE_URL") ?? "http://localhost:5050";
        var workerSupportedAgentFamilies = WorkerRuntimeCatalog.ResolveSupportedAgentFamilies(
            Environment.GetEnvironmentVariable("WORKER_SUPPORTED_AGENT_FAMILIES"));
        var workerRuntimeCommand = WorkerRuntimeCatalog.ResolveDefaultRuntimeCommand(
            workerSupportedAgentFamilies,
            null);
        var workerModelName = WorkerRuntimeCatalog.ResolveWorkerModelName(
            null,
            workerSupportedAgentFamilies,
            workerRuntimeCommand);
        var workerTokenCachePath = Environment.GetEnvironmentVariable("WORKER_TOKEN_CACHE_PATH")
            ?? WorkerGatewayAccessTokenManager.ResolveDefaultCachePath(gatewayBaseUrl, workerId);
        var workerUserKey = Environment.GetEnvironmentVariable("WORKER_USER_KEY");
        var hubUrl = $"{gatewayBaseUrl.TrimEnd('/')}/hubs/relay";
        var workerLogLevel = ParseLogLevel(
            Environment.GetEnvironmentVariable("WORKER_LOG_LEVEL")
            ?? Environment.GetEnvironmentVariable("LOG_LEVEL"));

        return new WorkerHostOptions(
            workerId,
            gatewayBaseUrl,
            workerId,
            workerModelName,
            workerRuntimeCommand,
            workerSupportedAgentFamilies,
            [],
            workerTokenCachePath,
            workerUserKey,
            hubUrl,
            DefaultWorkerHubTransport,
            workerLogLevel,
            DefaultWorkerHeartbeatInterval,
            DefaultWorkerSessionMaintenance);
    }

    private static string ResolveWorkerId(string? configuredWorkerId)
    {
        if (!string.IsNullOrWhiteSpace(configuredWorkerId))
        {
            return configuredWorkerId.Trim();
        }

        var hostName = Environment.MachineName;
        var normalizedHostName = string.Concat(
            hostName
                .Trim()
                .ToLowerInvariant()
                .Select(character => char.IsLetterOrDigit(character) ? character : '-'))
            .Trim('-');

        if (string.IsNullOrWhiteSpace(normalizedHostName))
        {
            normalizedHostName = "worker";
        }

        return $"{normalizedHostName}-{Guid.NewGuid():N}"[..Math.Min(normalizedHostName.Length + 7, normalizedHostName.Length + 1 + 6)];
    }

    private static LogLevel ParseLogLevel(string? value)
    {
        return Enum.TryParse<LogLevel>(value, true, out var level)
            ? level
            : LogLevel.Information;
    }

}