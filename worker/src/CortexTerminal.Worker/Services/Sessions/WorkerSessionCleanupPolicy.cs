namespace CortexTerminal.Worker.Services.Sessions;

public static class WorkerSessionCleanupPolicy
{
    public static WorkerSessionCleanupDecision Evaluate(
        WorkerAgentSession session,
        GatewayManagementClient.GatewaySessionSnapshot? gatewaySnapshot,
        WorkerSessionMaintenanceOptions options,
        DateTimeOffset utcNow)
    {
        if (gatewaySnapshot is null)
        {
            return new WorkerSessionCleanupDecision(
                true,
                false,
                "gateway-session-missing",
                "Gateway session record no longer exists.");
        }

        if (string.Equals(gatewaySnapshot.State, "Closed", StringComparison.OrdinalIgnoreCase))
        {
            return new WorkerSessionCleanupDecision(
                true,
                false,
                "gateway-session-closed",
                "Gateway session is already closed.");
        }

        if (string.Equals(gatewaySnapshot.State, "Disconnected", StringComparison.OrdinalIgnoreCase))
        {
            if (options.DisconnectedGracePeriod <= TimeSpan.Zero)
            {
                return new WorkerSessionCleanupDecision(
                    true,
                    options.CloseGatewaySessionOnCleanup,
                    "reconnect-grace-disabled",
                    "Gateway session is disconnected and reconnect grace is disabled.");
            }

            var disconnectedAtUtc = new DateTimeOffset(DateTime.SpecifyKind(gatewaySnapshot.UpdatedAtUtc, DateTimeKind.Utc));
            if (utcNow - disconnectedAtUtc >= options.DisconnectedGracePeriod)
            {
                return new WorkerSessionCleanupDecision(
                    true,
                    options.CloseGatewaySessionOnCleanup,
                    "reconnect-grace-expired",
                    $"Gateway session remained disconnected longer than the configured grace period ({options.DisconnectedGracePeriod}).");
            }

            return WorkerSessionCleanupDecision.None;
        }

        if (options.IdleTimeout > TimeSpan.Zero && utcNow - session.LastInboundAtUtc >= options.IdleTimeout)
        {
            return new WorkerSessionCleanupDecision(
                true,
                options.CloseGatewaySessionOnCleanup,
                "idle-timeout",
                $"No mobile input was received for {options.IdleTimeout}.");
        }

        return WorkerSessionCleanupDecision.None;
    }
}