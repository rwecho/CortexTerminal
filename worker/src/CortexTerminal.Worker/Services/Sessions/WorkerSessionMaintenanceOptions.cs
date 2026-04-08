namespace CortexTerminal.Worker.Services.Sessions;

public sealed record WorkerSessionMaintenanceOptions(
    TimeSpan IdleTimeout,
    TimeSpan DisconnectedGracePeriod,
    TimeSpan SweepInterval,
    bool CloseGatewaySessionOnCleanup)
{
    public bool IsEnabled => IdleTimeout > TimeSpan.Zero || DisconnectedGracePeriod > TimeSpan.Zero;
}