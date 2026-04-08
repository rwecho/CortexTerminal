using CortexTerminal.Worker.Services;
using CortexTerminal.Worker.Services.Runtime;
using CortexTerminal.Worker.Services.Sessions;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.Logging;

const int maxBufferLines = 2000;

var workerOptions = WorkerHostOptions.LoadFromEnvironment();

using var loggerFactory = LoggerFactory.Create(logging =>
{
    logging.ClearProviders();
    logging.AddSimpleConsole(options =>
    {
        options.SingleLine = true;
        options.TimestampFormat = "yyyy-MM-dd HH:mm:ss.fff zzz ";
    });
    logging.SetMinimumLevel(workerOptions.WorkerLogLevel);
});

var logger = loggerFactory.CreateLogger("CortexTerminal.Worker");
var managementLogger = loggerFactory.CreateLogger<GatewayManagementClient>();
var authLogger = loggerFactory.CreateLogger<WorkerGatewayAuthClient>();
var tokenManagerLogger = loggerFactory.CreateLogger<WorkerGatewayAccessTokenManager>();
var heartbeatLogger = loggerFactory.CreateLogger<WorkerHeartbeatReporter>();

var ringBuffer = new RingBuffer(maxBufferLines);
using var managementHttpClient = new HttpClient
{
    BaseAddress = new Uri($"{workerOptions.GatewayBaseUrl.TrimEnd('/')}/")
};
using var authHttpClient = new HttpClient
{
    BaseAddress = new Uri($"{workerOptions.GatewayBaseUrl.TrimEnd('/')}/")
};
var workerGatewayAuthClient = new WorkerGatewayAuthClient(authHttpClient, authLogger);
var workerAccessTokenManager = new WorkerGatewayAccessTokenManager(
    workerGatewayAuthClient,
    tokenManagerLogger,
    workerOptions.WorkerId,
    workerOptions.WorkerDisplayName,
    workerOptions.WorkerTokenCachePath,
    workerOptions.WorkerUserKey);
var gatewayManagementClient = new GatewayManagementClient(
    managementHttpClient,
    workerAccessTokenManager.GetAccessTokenAsync,
    managementLogger);
var workerHeartbeatReporter = new WorkerHeartbeatReporter(
    gatewayManagementClient,
    heartbeatLogger,
    workerOptions.WorkerId,
    workerOptions.WorkerHeartbeatInterval);

using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cts.Cancel();
};

var connection = new HubConnectionBuilder()
    .WithUrl(workerOptions.HubUrl, options =>
    {
        options.AccessTokenProvider = async () => (string?)await workerAccessTokenManager.GetAccessTokenAsync(cts.Token);
    })
    .WithAutomaticReconnect()
    .Build();

var sessionCoordinator = new WorkerSessionCoordinator(
    gatewayManagementClient,
    connection,
    logger,
    workerOptions.WorkerId,
    workerOptions.WorkerModelName,
    workerOptions.WorkerRuntimeCommand,
    workerOptions.WorkerAvailablePaths);
var frameDispatcher = new WorkerMobileFrameDispatcher(
    sessionCoordinator,
    ringBuffer,
    logger,
    workerOptions.WorkerId,
    workerOptions.WorkerModelName);

connection.On<string, string, string?, string?>("ReceiveFromMobile", async (sessionId, encryptedFrameBase64, requestId, traceId) =>
    await frameDispatcher.HandleAsync(sessionId, encryptedFrameBase64, requestId, traceId, cts.Token));

connection.Reconnected += async _ =>
{
    await gatewayManagementClient.UpsertWorkerAsync(workerOptions.WorkerId, workerOptions.WorkerDisplayName, workerOptions.WorkerModelName, workerOptions.WorkerAvailablePaths, workerOptions.WorkerSupportedAgentFamilies, cts.Token);
    await connection.InvokeAsync("RegisterWorker", workerOptions.WorkerId, cts.Token);
    logger.LogInformation("[worker:reconnected] WorkerId={WorkerId}", workerOptions.WorkerId);
};

logger.LogInformation("[worker:start] WorkerId={WorkerId}, HubUrl={HubUrl}, LogLevel={LogLevel}", workerOptions.WorkerId, workerOptions.HubUrl, workerOptions.WorkerLogLevel);
logger.LogInformation("[worker:runtime] WorkerId={WorkerId}, ModelName={ModelName}, Command={Command}", workerOptions.WorkerId, workerOptions.WorkerModelName, workerOptions.WorkerRuntimeCommand);
logger.LogInformation("[worker:supported-agent-families] WorkerId={WorkerId}, AgentFamilies={AgentFamilies}", workerOptions.WorkerId, string.Join(",", workerOptions.WorkerSupportedAgentFamilies));
logger.LogInformation("[worker:auth-mode] WorkerId={WorkerId}, RegistrationKeyConfigured={RegistrationKeyConfigured}", workerOptions.WorkerId, !string.IsNullOrWhiteSpace(workerOptions.WorkerUserKey));
logger.LogInformation(
    "[worker:session-policy] IdleTimeout={IdleTimeout}, DisconnectedGrace={DisconnectedGrace}, SweepInterval={SweepInterval}, CloseGatewaySessionOnCleanup={CloseGatewaySessionOnCleanup}",
    workerOptions.WorkerSessionMaintenance.IdleTimeout,
    workerOptions.WorkerSessionMaintenance.DisconnectedGracePeriod,
    workerOptions.WorkerSessionMaintenance.SweepInterval,
    workerOptions.WorkerSessionMaintenance.CloseGatewaySessionOnCleanup);

await workerAccessTokenManager.GetAccessTokenAsync(cts.Token);
var heartbeatTask = workerHeartbeatReporter.RunAsync(
    () => connection.State == HubConnectionState.Connected,
    cts.Token);
var sessionMaintenanceTask = sessionCoordinator.RunMaintenanceLoopAsync(
    workerOptions.WorkerSessionMaintenance,
    cts.Token);

while (!cts.IsCancellationRequested)
{
    try
    {
        if (connection.State == HubConnectionState.Disconnected)
        {
            await connection.StartAsync(cts.Token);
            await gatewayManagementClient.UpsertWorkerAsync(workerOptions.WorkerId, workerOptions.WorkerDisplayName, workerOptions.WorkerModelName, workerOptions.WorkerAvailablePaths, workerOptions.WorkerSupportedAgentFamilies, cts.Token);
            await connection.InvokeAsync("RegisterWorker", workerOptions.WorkerId, cts.Token);
            logger.LogInformation("[worker:connected] WorkerId={WorkerId}", workerOptions.WorkerId);
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
await sessionMaintenanceTask;

logger.LogInformation("[worker:stopped] BufferedLines={BufferedLines}", ringBuffer.Count);
sessionCoordinator.Dispose();
