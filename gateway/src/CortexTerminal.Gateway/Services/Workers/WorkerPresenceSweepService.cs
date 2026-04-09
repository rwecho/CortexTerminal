using Microsoft.Extensions.DependencyInjection;

namespace CortexTerminal.Gateway.Services.Workers;

public sealed class WorkerPresenceSweepService(
    IServiceProvider serviceProvider,
    ILogger<WorkerPresenceSweepService> logger) : BackgroundService
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(SweepInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                {
                    break;
                }

                await using var scope = serviceProvider.CreateAsyncScope();
                var workerManagementService = scope.ServiceProvider.GetRequiredService<IWorkerManagementService>();
                var changed = await workerManagementService.ReconcilePresenceAsync(stoppingToken);

                if (changed)
                {
                    logger.LogInformation("[worker-presence-sweep] Reconciled stale worker presence.");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[worker-presence-sweep] Failed to reconcile worker presence.");
            }
        }
    }
}