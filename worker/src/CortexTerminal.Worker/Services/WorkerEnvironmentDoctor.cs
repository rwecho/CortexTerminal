using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace CortexTerminal.Worker.Services;

public static class WorkerEnvironmentDoctor
{
    private static readonly IReadOnlyList<EnvironmentProbeDefinition> DefaultProbeDefinitions =
    [
        new("node", "node", ["--version"]),
        new("npm", "npm", ["--version"]),
        new("npx", "npx", ["--version"]),
        new("dotnet", "dotnet", ["--version"]),
        new("claude", "claude", ["--version"]),
        new("codex", "codex", ["--version"]),
        new("opencode", "opencode", ["--version"]),
        new("gemini", "gemini", ["--version"]),
    ];

    public static async Task<string> RunAsync(
        string workerId,
        string workerModelName,
        string workerRuntimeCommand,
        string workingDirectory,
        CancellationToken cancellationToken)
    {
        var probeResults = new List<EnvironmentProbeResult>(DefaultProbeDefinitions.Count);

        foreach (var probeDefinition in DefaultProbeDefinitions)
        {
            probeResults.Add(await ExecuteProbeAsync(probeDefinition, workingDirectory, cancellationToken));
        }

        return BuildReport(
            workerId,
            workerModelName,
            workerRuntimeCommand,
            workingDirectory,
            probeResults);
    }

    public static string BuildReport(
        string workerId,
        string workerModelName,
        string workerRuntimeCommand,
        string workingDirectory,
        IReadOnlyList<EnvironmentProbeResult> probeResults)
    {
        var builder = new StringBuilder();
        builder.AppendLine("[worker doctor] 环境诊断结果");
        builder.Append("workerId: ").AppendLine(workerId);
        builder.Append("model: ").AppendLine(workerModelName);
        builder.Append("runtimeCommand: ").AppendLine(workerRuntimeCommand);
        builder.Append("workingDirectory: ").AppendLine(workingDirectory);
        builder.Append("os: ").Append(RuntimeInformation.OSDescription)
            .Append(" (")
            .Append(RuntimeInformation.OSArchitecture)
            .AppendLine(")");
        builder.Append("processArchitecture: ").AppendLine(RuntimeInformation.ProcessArchitecture.ToString());
        builder.Append("dotnetRuntime: ").AppendLine(Environment.Version.ToString());
        builder.AppendLine();
        builder.AppendLine("版本探测：");

        foreach (var probeResult in probeResults)
        {
            builder.Append("- ")
                .Append(probeResult.Name)
                .Append(": ");

            if (probeResult.IsAvailable)
            {
                builder.Append(probeResult.Output);
            }
            else
            {
                builder.Append("missing");
            }

            if (!string.IsNullOrWhiteSpace(probeResult.Details))
            {
                builder.Append(" (")
                    .Append(probeResult.Details)
                    .Append(')');
            }

            builder.AppendLine();
        }

        builder.AppendLine();
        builder.AppendLine("提示：如果某个 CLI 显示 missing，请在该 worker 节点安装或补 PATH。\r");
        return builder.ToString();
    }

    private static async Task<EnvironmentProbeResult> ExecuteProbeAsync(
        EnvironmentProbeDefinition probeDefinition,
        string workingDirectory,
        CancellationToken cancellationToken)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = probeDefinition.FileName,
                WorkingDirectory = workingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            }
        };

        foreach (var argument in probeDefinition.Arguments)
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        try
        {
            process.Start();
        }
        catch (Exception exception)
        {
            return new EnvironmentProbeResult(
                probeDefinition.Name,
                false,
                null,
                exception.Message);
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            TryKillProcess(process);
            return new EnvironmentProbeResult(
                probeDefinition.Name,
                false,
                null,
                "timed out after 5s");
        }

        var stdout = (await process.StandardOutput.ReadToEndAsync(cancellationToken)).Trim();
        var stderr = (await process.StandardError.ReadToEndAsync(cancellationToken)).Trim();
        var output = !string.IsNullOrWhiteSpace(stdout)
            ? stdout
            : !string.IsNullOrWhiteSpace(stderr)
                ? stderr
                : $"exit code {process.ExitCode}";

        return process.ExitCode == 0
            ? new EnvironmentProbeResult(probeDefinition.Name, true, output, null)
            : new EnvironmentProbeResult(probeDefinition.Name, false, null, output);
    }

    private static void TryKillProcess(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // ignore cleanup issues
        }
    }
}

public sealed record EnvironmentProbeDefinition(
    string Name,
    string FileName,
    IReadOnlyList<string> Arguments);

public sealed record EnvironmentProbeResult(
    string Name,
    bool IsAvailable,
    string? Output,
    string? Details);