using Microsoft.Extensions.Logging;

namespace CortexTerminal.Worker.Services;

public sealed class WorkerHeartbeatReporter(
    GatewayManagementClient gatewayManagementClient,
    ILogger<WorkerHeartbeatReporter> logger,
    string workerId,
    TimeSpan interval)
{
    public async Task RunAsync(Func<bool> isWorkerConnected, CancellationToken cancellationToken)
    {
        using var timer = new PeriodicTimer(interval);

        try
        {
            while (await timer.WaitForNextTickAsync(cancellationToken))
            {
                if (!isWorkerConnected())
                {
                    continue;
                }

                try
                {
                    await gatewayManagementClient.RecordHeartbeatAsync(workerId, cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "[worker:heartbeat-failed] WorkerId={WorkerId}", workerId);
                }
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // expected during shutdown
        }
    }
}