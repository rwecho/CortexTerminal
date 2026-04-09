using Microsoft.Extensions.Logging;
using CortexTerminal.Worker.Services.Sessions;

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
    LogLevel WorkerLogLevel,
    TimeSpan WorkerHeartbeatInterval,
    WorkerSessionMaintenanceOptions WorkerSessionMaintenance)
{
    public static WorkerHostOptions LoadFromEnvironment()
    {
        var workerId = Environment.GetEnvironmentVariable("WORKER_ID") ?? "worker-1";
        var gatewayBaseUrl = Environment.GetEnvironmentVariable("GATEWAY_BASE_URL") ?? "http://localhost:5050";
        var workerDisplayName = Environment.GetEnvironmentVariable("WORKER_DISPLAY_NAME") ?? workerId;
        var workerSupportedAgentFamilies = WorkerRuntimeCatalog.ResolveSupportedAgentFamilies(
            Environment.GetEnvironmentVariable("WORKER_SUPPORTED_AGENT_FAMILIES"));
        var workerRuntimeCommand = WorkerRuntimeCatalog.ResolveDefaultRuntimeCommand(
            workerSupportedAgentFamilies,
            Environment.GetEnvironmentVariable("WORKER_RUNTIME_COMMAND"),
            Environment.GetEnvironmentVariable("WORKER_MODEL_NAME"));
        var workerModelName = WorkerRuntimeCatalog.ResolveWorkerModelName(
            Environment.GetEnvironmentVariable("WORKER_MODEL_NAME"),
            workerSupportedAgentFamilies,
            workerRuntimeCommand);
        var workerAvailablePaths = ParseAvailablePaths(
            Environment.GetEnvironmentVariable("WORKER_AVAILABLE_PATHS"),
            Environment.CurrentDirectory);
        var workerTokenCachePath = Environment.GetEnvironmentVariable("WORKER_TOKEN_CACHE_PATH")
            ?? WorkerGatewayAccessTokenManager.ResolveDefaultCachePath(gatewayBaseUrl, workerId);
        var workerUserKey = Environment.GetEnvironmentVariable("WORKER_USER_KEY");
        var hubUrl = $"{gatewayBaseUrl.TrimEnd('/')}/hubs/relay";
        var workerLogLevel = ParseLogLevel(
            Environment.GetEnvironmentVariable("WORKER_LOG_LEVEL")
            ?? Environment.GetEnvironmentVariable("LOG_LEVEL"));
        var workerHeartbeatInterval = ParseHeartbeatInterval(
            Environment.GetEnvironmentVariable("WORKER_HEARTBEAT_INTERVAL_SECONDS"));
        var workerSessionMaintenance = new WorkerSessionMaintenanceOptions(
            ParseConfiguredInterval(Environment.GetEnvironmentVariable("WORKER_SESSION_IDLE_TIMEOUT_SECONDS"), TimeSpan.FromMinutes(20)),
            ParseConfiguredInterval(Environment.GetEnvironmentVariable("WORKER_SESSION_DISCONNECTED_GRACE_SECONDS"), TimeSpan.FromMinutes(2)),
            ParseConfiguredInterval(Environment.GetEnvironmentVariable("WORKER_SESSION_SWEEP_INTERVAL_SECONDS"), TimeSpan.FromSeconds(30)),
            ParseBoolean(Environment.GetEnvironmentVariable("WORKER_CLOSE_GATEWAY_SESSION_ON_CLEANUP"), true));

        return new WorkerHostOptions(
            workerId,
            gatewayBaseUrl,
            workerDisplayName,
            workerModelName,
            workerRuntimeCommand,
            workerSupportedAgentFamilies,
            workerAvailablePaths,
            workerTokenCachePath,
            workerUserKey,
            hubUrl,
            workerLogLevel,
            workerHeartbeatInterval,
            workerSessionMaintenance);
    }

    private static LogLevel ParseLogLevel(string? value)
    {
        return Enum.TryParse<LogLevel>(value, true, out var level)
            ? level
            : LogLevel.Information;
    }

    private static TimeSpan ParseHeartbeatInterval(string? value)
    {
        if (int.TryParse(value, out var seconds) && seconds > 0)
        {
            return TimeSpan.FromSeconds(seconds);
        }

        return TimeSpan.FromSeconds(30);
    }

    private static TimeSpan ParseConfiguredInterval(string? value, TimeSpan fallback)
    {
        if (int.TryParse(value, out var seconds) && seconds >= 0)
        {
            return TimeSpan.FromSeconds(seconds);
        }

        return fallback;
    }

    private static bool ParseBoolean(string? value, bool fallback)
    {
        return bool.TryParse(value, out var parsed) ? parsed : fallback;
    }

    private static string[] ParseAvailablePaths(string? value, string fallbackPath)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [Path.GetFullPath(fallbackPath)];
        }

        var paths = value
            .Split(['\n', '\r', ','], StringSplitOptions.RemoveEmptyEntries)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Select(Path.GetFullPath)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return paths.Length == 0 ? [Path.GetFullPath(fallbackPath)] : paths;
    }
}