namespace CortexTerminal.Gateway.Services.Workers;

internal static class WorkerPresencePolicy
{
    internal static readonly TimeSpan MaxWorkerSilence = TimeSpan.FromSeconds(15);

    public static bool IsWorkerOnline(WorkerPresenceSnapshot? presence, DateTime utcNow)
    {
        return presence is not null && presence.LastSeenUtc >= utcNow - MaxWorkerSilence;
    }
}
