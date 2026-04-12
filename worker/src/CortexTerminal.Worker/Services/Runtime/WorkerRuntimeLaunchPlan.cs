using Pty.Net;

namespace CortexTerminal.Worker.Services.Runtime;

public sealed record WorkerRuntimeLaunchPlan(
    string ShellApp,
    string EntrypointPath,
    string RuntimeCommand,
    string WorkingDirectory,
    string[] CommandLine,
    IReadOnlyDictionary<string, string> Environment,
    IReadOnlyList<string>? RuntimeArguments = null,
    int InitialCols = 120,
    int InitialRows = 40)
{
    public PtyOptions ToPtyOptions()
    {
        return new PtyOptions
        {
            App = ShellApp,
            Cwd = WorkingDirectory,
            CommandLine = CommandLine,
            Environment = new Dictionary<string, string>(Environment, StringComparer.Ordinal),
            Cols = InitialCols,
            Rows = InitialRows
        };
    }
}
