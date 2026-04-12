namespace CortexTerminal.Worker.Services.Runtime.Adapters;

public sealed class CopilotWorkerRuntimeAdapter() : WorkerRuntimeAdapterBase("copilot")
{
    public override bool RequiresPromptReadiness => true;

    public override bool IsPromptReady(string transcript)
    {
        if (string.IsNullOrWhiteSpace(transcript))
        {
            return false;
        }

        return (transcript.Contains("GitHub Copilot", StringComparison.OrdinalIgnoreCase)
                || transcript.Contains("Copilot v", StringComparison.OrdinalIgnoreCase))
            && (transcript.Contains("Describe a task to get started.", StringComparison.OrdinalIgnoreCase)
                || transcript.Contains("Type @ to mention files", StringComparison.OrdinalIgnoreCase)
                || transcript.Contains("? for shortcuts", StringComparison.OrdinalIgnoreCase));
    }
}
