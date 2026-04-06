using System.Collections.Concurrent;
using System.Text;
using CortexTerminal.Worker.Services;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;
using Pty.Net;

const int maxBufferLines = 2000;

var workerId = Environment.GetEnvironmentVariable("WORKER_ID") ?? "worker-1";
var gatewayBaseUrl = Environment.GetEnvironmentVariable("GATEWAY_BASE_URL") ?? "http://localhost:5050";
var workerDisplayName = Environment.GetEnvironmentVariable("WORKER_DISPLAY_NAME") ?? workerId;
var workerModelName = Environment.GetEnvironmentVariable("WORKER_MODEL_NAME") ?? "Claude CLI";
var workerRuntimeCommand = ResolveRuntimeCommand(
    workerModelName,
    Environment.GetEnvironmentVariable("WORKER_RUNTIME_COMMAND"));
var workerAvailablePaths = ParseAvailablePaths(
    Environment.GetEnvironmentVariable("WORKER_AVAILABLE_PATHS"),
    Environment.CurrentDirectory);
var workerTokenCachePath = Environment.GetEnvironmentVariable("WORKER_TOKEN_CACHE_PATH")
    ?? WorkerGatewayAccessTokenManager.ResolveDefaultCachePath(gatewayBaseUrl, workerId);
var hubUrl = $"{gatewayBaseUrl.TrimEnd('/')}/hubs/relay";
var workerLogLevel = ParseLogLevel(
    Environment.GetEnvironmentVariable("WORKER_LOG_LEVEL")
    ?? Environment.GetEnvironmentVariable("LOG_LEVEL"));
var workerHeartbeatInterval = ParseHeartbeatInterval(
    Environment.GetEnvironmentVariable("WORKER_HEARTBEAT_INTERVAL_SECONDS"));

using var loggerFactory = LoggerFactory.Create(logging =>
{
    logging.ClearProviders();
    logging.AddSimpleConsole(options =>
    {
        options.SingleLine = true;
        options.TimestampFormat = "yyyy-MM-dd HH:mm:ss.fff zzz ";
    });
    logging.SetMinimumLevel(workerLogLevel);
});

var logger = loggerFactory.CreateLogger("CortexTerminal.Worker");
var managementLogger = loggerFactory.CreateLogger<GatewayManagementClient>();
var authLogger = loggerFactory.CreateLogger<WorkerGatewayAuthClient>();
var tokenManagerLogger = loggerFactory.CreateLogger<WorkerGatewayAccessTokenManager>();
var heartbeatLogger = loggerFactory.CreateLogger<WorkerHeartbeatReporter>();

var ringBuffer = new RingBuffer(maxBufferLines);
var sessionPtys = new ConcurrentDictionary<string, ClaudeSession>(StringComparer.Ordinal);
var ptyCreationLock = new SemaphoreSlim(1, 1);
using var managementHttpClient = new HttpClient
{
    BaseAddress = new Uri($"{gatewayBaseUrl.TrimEnd('/')}/")
};
using var authHttpClient = new HttpClient
{
    BaseAddress = new Uri($"{gatewayBaseUrl.TrimEnd('/')}/")
};
var workerGatewayAuthClient = new WorkerGatewayAuthClient(authHttpClient, authLogger);
var workerAccessTokenManager = new WorkerGatewayAccessTokenManager(
    workerGatewayAuthClient,
    tokenManagerLogger,
    workerId,
    workerDisplayName,
    workerTokenCachePath);
var gatewayManagementClient = new GatewayManagementClient(
    managementHttpClient,
    workerAccessTokenManager.GetAccessTokenAsync,
    managementLogger);
var workerHeartbeatReporter = new WorkerHeartbeatReporter(
    gatewayManagementClient,
    heartbeatLogger,
    workerId,
    workerHeartbeatInterval);

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cts.Cancel();
};

var connection = new HubConnectionBuilder()
    .WithUrl(hubUrl, options =>
    {
        options.AccessTokenProvider = async () => (string?)await workerAccessTokenManager.GetAccessTokenAsync(cts.Token);
    })
    .WithAutomaticReconnect()
    .Build();

connection.On<string, string, string?, string?>("ReceiveFromMobile", async (sessionId, encryptedFrameBase64, requestId, traceId) =>
{
    var inbound = Encoding.UTF8.GetString(Convert.FromBase64String(encryptedFrameBase64));
    ringBuffer.Append($"[{DateTimeOffset.UtcNow:O}] mobile:{sessionId} => {inbound}");

    logger.LogInformation(
        "[relay-gateway->worker:recv] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, Base64Length={Base64Length}, PlaintextLength={PlaintextLength}",
        sessionId,
        requestId,
        traceId,
        encryptedFrameBase64.Length,
        inbound.Length);
    logger.LogDebug(
        "[relay-gateway->worker:recv:payload] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadBase64={PayloadBase64}",
        sessionId,
        requestId,
        traceId,
        encryptedFrameBase64);
    logger.LogDebug(
        "[relay-gateway->worker:recv:text] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadText={PayloadText}",
        sessionId,
        requestId,
        traceId,
        inbound);

    var session = await GetOrCreateClaudeSessionAsync(
        sessionId,
        requestId,
        traceId,
        sessionPtys,
        ptyCreationLock,
        workerId,
        workerModelName,
        workerRuntimeCommand,
        gatewayManagementClient,
        workerAvailablePaths,
        logger,
        connection,
        cts.Token);

    if (session is null)
    {
        await RelayTextFrameAsync(
            connection,
            sessionId,
            $"__ct_error__:{workerModelName} session startup failed. 请检查 worker 节点的 {workerRuntimeCommand} CLI 安装/登录状态。\r\n",
            requestId,
            traceId,
            logger,
            cts.Token);
        return;
    }

    session.LastTraceId = traceId;

    if (string.Equals(inbound.Trim(), "__ct_init__", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    if (string.Equals(inbound.Trim(), "/__ct_pwd", StringComparison.OrdinalIgnoreCase))
    {
        await RelayTextFrameAsync(
            connection,
            sessionId,
            $"__ct_cwd__:{session.WorkingDirectory}\n[worker] {workerModelName} session is ready.\r\n",
            requestId,
            traceId,
            logger,
            cts.Token);
        return;
    }

    var forwardedInput = NormalizeAgentInput(inbound);
    logger.LogInformation("[agent:stdin] SessionId={SessionId}, Length={Length}, Runtime={Runtime}", sessionId, forwardedInput.Length, workerRuntimeCommand);
    await WriteClaudeInputAsync(session, forwardedInput, cts.Token);
});

connection.Reconnected += async _ =>
{
    await gatewayManagementClient.UpsertWorkerAsync(workerId, workerDisplayName, workerModelName, workerAvailablePaths, cts.Token);
    await connection.InvokeAsync("RegisterWorker", workerId, cts.Token);
    logger.LogInformation("[worker:reconnected] WorkerId={WorkerId}", workerId);
};

logger.LogInformation("[worker:start] WorkerId={WorkerId}, HubUrl={HubUrl}, LogLevel={LogLevel}", workerId, hubUrl, workerLogLevel);
logger.LogInformation("[worker:runtime] WorkerId={WorkerId}, ModelName={ModelName}, Command={Command}", workerId, workerModelName, workerRuntimeCommand);

await workerAccessTokenManager.GetAccessTokenAsync(cts.Token);
var heartbeatTask = workerHeartbeatReporter.RunAsync(
    () => connection.State == HubConnectionState.Connected,
    cts.Token);

while (!cts.IsCancellationRequested)
{
    try
    {
        if (connection.State == HubConnectionState.Disconnected)
        {
            await connection.StartAsync(cts.Token);
            await gatewayManagementClient.UpsertWorkerAsync(workerId, workerDisplayName, workerModelName, workerAvailablePaths, cts.Token);
            await connection.InvokeAsync("RegisterWorker", workerId, cts.Token);
            logger.LogInformation("[worker:connected] WorkerId={WorkerId}", workerId);
        }

        await Task.Delay(TimeSpan.FromSeconds(2), cts.Token);
    }
    catch (OperationCanceledException)
    {
        break;
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[worker:error] reconnecting after error.");
        await Task.Delay(TimeSpan.FromSeconds(2), cts.Token);
    }
}

if (connection.State != HubConnectionState.Disconnected)
{
    await connection.StopAsync();
}

await heartbeatTask;

logger.LogInformation("[worker:stopped] BufferedLines={BufferedLines}", ringBuffer.Count);

foreach (var ptySession in sessionPtys.Values)
{
    try
    {
        ptySession.Dispose();
    }
    catch
    {
        // ignore cleanup errors
    }
}

static string NormalizeAgentInput(string inbound)
{
    var knownPrefixes = new[] { "/claude ", "/codex ", "/gemini ", "/opencode ", "/open code " };

    foreach (var prefix in knownPrefixes)
    {
        if (inbound.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && inbound.Length > prefix.Length)
        {
            var prompt = inbound[prefix.Length..].Trim();
            return prompt.Length > 0 ? prompt : inbound;
        }
    }

    return inbound;
}

static string ResolveRuntimeCommand(string modelName, string? configuredCommand)
{
    if (!string.IsNullOrWhiteSpace(configuredCommand))
    {
        return configuredCommand.Trim();
    }

    var normalizedModelName = modelName.Trim().ToLowerInvariant();
    if (normalizedModelName.Contains("codex"))
    {
        return "codex";
    }

    if (normalizedModelName.Contains("gemini"))
    {
        return "gemini";
    }

    if (normalizedModelName.Contains("opencode") || normalizedModelName.Contains("open code"))
    {
        return "opencode";
    }

    return "claude";
}

static async Task WriteClaudeInputAsync(ClaudeSession session, string input, CancellationToken cancellationToken)
{
    await session.CommandLock.WaitAsync(cancellationToken);
    try
    {
        if (!string.IsNullOrEmpty(input))
        {
            foreach (var character in input)
            {
                var keyBytes = Encoding.UTF8.GetBytes(character.ToString());
                await session.WriterStream.WriteAsync(keyBytes, cancellationToken);
                await session.WriterStream.FlushAsync(cancellationToken);
                await Task.Delay(5, cancellationToken);
            }

            await Task.Delay(20, cancellationToken);
        }

        await session.WriterStream.WriteAsync(new byte[] { 0x0D }, cancellationToken);
        await session.WriterStream.FlushAsync(cancellationToken);
    }
    finally
    {
        session.CommandLock.Release();
    }
}

static LogLevel ParseLogLevel(string? value)
{
    return Enum.TryParse<LogLevel>(value, true, out var level)
        ? level
        : LogLevel.Information;
}

static TimeSpan ParseHeartbeatInterval(string? value)
{
    if (int.TryParse(value, out var seconds) && seconds > 0)
    {
        return TimeSpan.FromSeconds(seconds);
    }

    return TimeSpan.FromSeconds(30);
}

static string[] ParseAvailablePaths(string? value, string fallbackPath)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return [Path.GetFullPath(fallbackPath)];
    }

    var paths = value
        .Split(new[] { '\n', '\r', ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Where(path => !string.IsNullOrWhiteSpace(path))
        .Select(Path.GetFullPath)
        .Distinct(StringComparer.Ordinal)
        .ToArray();

    return paths.Length == 0 ? [Path.GetFullPath(fallbackPath)] : paths;
}

static async Task<ClaudeSession?> GetOrCreateClaudeSessionAsync(
    string sessionId,
    string? requestId,
    string? traceId,
    ConcurrentDictionary<string, ClaudeSession> sessions,
    SemaphoreSlim creationLock,
    string workerId,
    string workerModelName,
    string workerRuntimeCommand,
    GatewayManagementClient gatewayManagementClient,
    IReadOnlyList<string> availablePaths,
    ILogger logger,
    HubConnection connection,
    CancellationToken cancellationToken)
{
    if (sessions.TryGetValue(sessionId, out var existingSession))
    {
        return existingSession;
    }

    await creationLock.WaitAsync(cancellationToken);
    try
    {
        if (sessions.TryGetValue(sessionId, out existingSession))
        {
            return existingSession;
        }

        var sessionSnapshot = await gatewayManagementClient.GetSessionAsync(sessionId, cancellationToken);
        var workingDirectory = ResolveWorkingDirectory(sessionSnapshot?.WorkingDirectory, availablePaths, workerId);

        var ptyConnection = await PtyProvider.SpawnAsync(new PtyOptions
        {
            App = workerRuntimeCommand,
            Cwd = workingDirectory
        }, cancellationToken);
        var session = new ClaudeSession(
            sessionId,
            string.IsNullOrWhiteSpace(sessionSnapshot?.DisplayName) ? sessionId : sessionSnapshot.DisplayName.Trim(),
            workingDirectory,
            ptyConnection,
            new StreamReader(ptyConnection.ReaderStream, Encoding.UTF8, false, 1024, leaveOpen: true),
            ptyConnection.WriterStream,
            new StreamWriter(ptyConnection.WriterStream, new UTF8Encoding(false)) { AutoFlush = true },
            new SemaphoreSlim(1, 1));

        sessions[sessionId] = session;

        session.PumpTask = Task.Run(async () =>
        {
            await PumpClaudeOutputAsync(
                sessionId,
                session,
                sessions,
                connection,
                logger,
                cancellationToken);
        }, cancellationToken);

        logger.LogInformation("[worker:agent-session-ready] SessionId={SessionId}, Runtime={Runtime}, ModelName={ModelName}, WorkingDirectory={WorkingDirectory}", sessionId, workerRuntimeCommand, workerModelName, workingDirectory);
        await RelayTextFrameAsync(
            connection,
            sessionId,
            $"__ct_ready__:{workingDirectory}\r\n",
            requestId,
            traceId,
            logger,
            cancellationToken);
        return session;
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[worker:pty-create-failed] SessionId={SessionId}, Runtime={Runtime}, ModelName={ModelName}", sessionId, workerRuntimeCommand, workerModelName);
        return null;
    }
    finally
    {
        creationLock.Release();
    }
}

static string ResolveWorkingDirectory(string? requestedWorkingDirectory, IReadOnlyList<string> availablePaths, string workerId)
{
    var fallbackPath = availablePaths.Count > 0
        ? availablePaths[0]
        : Path.GetFullPath(Environment.CurrentDirectory);

    if (string.IsNullOrWhiteSpace(requestedWorkingDirectory))
    {
        return fallbackPath;
    }

    var normalizedRequestedPath = Path.GetFullPath(requestedWorkingDirectory.Trim());
    if (availablePaths.Count > 0 && !availablePaths.Contains(normalizedRequestedPath, StringComparer.Ordinal))
    {
        throw new InvalidOperationException($"Working directory '{normalizedRequestedPath}' is not allowed on worker '{workerId}'.");
    }

    if (!Directory.Exists(normalizedRequestedPath))
    {
        throw new DirectoryNotFoundException($"Working directory '{normalizedRequestedPath}' does not exist.");
    }

    return normalizedRequestedPath;
}

static async Task PumpClaudeOutputAsync(
    string sessionId,
    ClaudeSession session,
    ConcurrentDictionary<string, ClaudeSession> sessions,
    HubConnection connection,
    ILogger logger,
    CancellationToken cancellationToken,
    int bufferSize = 2048)
{
    try
    {
        var buffer = new char[bufferSize];
        while (!cancellationToken.IsCancellationRequested)
        {
            var read = await session.Reader.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken);
            if (read <= 0)
            {
                break;
            }

            var chunk = new string(buffer, 0, read);
            if (!string.IsNullOrEmpty(chunk))
            {
                await RelayTextFrameAsync(
                    connection,
                    sessionId,
                    chunk,
                    null,
                    session.LastTraceId,
                    logger,
                    cancellationToken);
            }
        }
    }
    catch (OperationCanceledException)
    {
        // expected on shutdown
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "[worker:agent-pump-failed] SessionId={SessionId}", sessionId);
        try
        {
            await RelayTextFrameAsync(
                connection,
                sessionId,
                "__ct_error__:Agent session disconnected unexpectedly.\r\n",
                null,
                session.LastTraceId,
                logger,
                cancellationToken);
        }
        catch
        {
            // ignore relay error during failure path
        }
    }
    finally
    {
        sessions.TryRemove(sessionId, out _);
        try
        {
            session.Dispose();
        }
        catch
        {
            // ignore
        }

        logger.LogInformation("[worker:agent-session-ended] SessionId={SessionId}", sessionId);
    }
}

static async Task RelayTextFrameAsync(
    HubConnection connection,
    string sessionId,
    string text,
    string? requestId,
    string? traceId,
    ILogger logger,
    CancellationToken cancellationToken)
{
    if (string.IsNullOrEmpty(text))
    {
        return;
    }

    var payloadBase64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
    logger.LogInformation(
        "[relay-worker->gateway:send] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, Base64Length={Base64Length}, PlaintextLength={PlaintextLength}",
        sessionId,
        requestId,
        traceId,
        payloadBase64.Length,
        text.Length);
    logger.LogDebug(
        "[relay-worker->gateway:send:text] SessionId={SessionId}, RequestId={RequestId}, TraceId={TraceId}, PayloadText={PayloadText}",
        sessionId,
        requestId,
        traceId,
        text);

    await connection.InvokeAsync("RelayFromWorker", sessionId, payloadBase64, requestId, traceId, cancellationToken);
}

file sealed class ClaudeSession(
    string SessionId,
    string DisplayName,
    string WorkingDirectory,
    IPtyConnection Connection,
    StreamReader Reader,
    Stream WriterStream,
    StreamWriter Writer,
    SemaphoreSlim CommandLock) : IDisposable
{
    public string SessionId { get; } = SessionId;
    public string DisplayName { get; } = DisplayName;
    public string WorkingDirectory { get; } = WorkingDirectory;
    public IPtyConnection Connection { get; } = Connection;
    public StreamReader Reader { get; } = Reader;
    public Stream WriterStream { get; } = WriterStream;
    public StreamWriter Writer { get; } = Writer;
    public SemaphoreSlim CommandLock { get; } = CommandLock;
    public Task? PumpTask { get; set; }
    public string? LastTraceId { get; set; }

    public void Dispose()
    {
        try
        {
            Writer.Dispose();
        }
        catch
        {
            // ignore
        }

        try
        {
            Reader.Dispose();
        }
        catch
        {
            // ignore
        }

        try
        {
            WriterStream.Dispose();
        }
        catch
        {
            // ignore
        }

        try
        {
            Connection.Dispose();
        }
        catch
        {
            // ignore
        }

        CommandLock.Dispose();
    }
}
