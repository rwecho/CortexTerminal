using System.Runtime.InteropServices;

namespace CortexTerminal.Worker.Services.Runtime;

public static class WorkerRuntimeLaunchPlanner
{
    public static WorkerRuntimeLaunchPlan BuildPlan(
        string runtimeCommand,
        string workingDirectory,
        IReadOnlyList<string>? runtimeArguments = null)
    {
        if (string.IsNullOrWhiteSpace(runtimeCommand))
        {
            throw new InvalidOperationException("Runtime command is required.");
        }

        if (string.IsNullOrWhiteSpace(workingDirectory))
        {
            throw new InvalidOperationException("Working directory is required.");
        }

        var scriptsDirectory = Path.Combine(AppContext.BaseDirectory, "scripts");
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var entrypointPath = Path.Combine(scriptsDirectory, "entrypoint.ps1");
            EnsureEntrypointExists(entrypointPath);
            return BuildWindowsPlan(
                runtimeCommand,
                workingDirectory,
                scriptsDirectory,
                ResolveWindowsShell(),
                entrypointPath,
                runtimeArguments);
        }

        var unixEntrypointPath = Path.Combine(scriptsDirectory, "entrypoint.sh");
        EnsureEntrypointExists(unixEntrypointPath);
        return BuildUnixPlan(
            runtimeCommand,
            workingDirectory,
            scriptsDirectory,
            ResolveUnixShell(),
            unixEntrypointPath,
            runtimeArguments);
    }

    public static WorkerRuntimeLaunchPlan BuildUnixPlan(
        string runtimeCommand,
        string workingDirectory,
        string scriptsDirectory,
        string shellPath,
        string? entrypointPath = null,
        IReadOnlyList<string>? runtimeArguments = null)
    {
        var normalizedEntrypointPath = entrypointPath ?? Path.Combine(scriptsDirectory, "entrypoint.sh");
        var environment = BuildEnvironment(runtimeCommand, workingDirectory, "unix");
        var commandLine = new List<string>
        {
            normalizedEntrypointPath,
            "--runtime",
            runtimeCommand,
            "--working-directory",
            workingDirectory
        };

        if (runtimeArguments is { Count: > 0 })
        {
            foreach (var runtimeArgument in runtimeArguments)
            {
                commandLine.Add("--runtime-arg");
                commandLine.Add(runtimeArgument);
            }
        }

        return new WorkerRuntimeLaunchPlan(
            shellPath,
            normalizedEntrypointPath,
            runtimeCommand,
            workingDirectory,
            [.. commandLine],
            environment,
            runtimeArguments);
    }

    public static WorkerRuntimeLaunchPlan BuildWindowsPlan(
        string runtimeCommand,
        string workingDirectory,
        string scriptsDirectory,
        string shellPath,
        string? entrypointPath = null,
        IReadOnlyList<string>? runtimeArguments = null)
    {
        var normalizedEntrypointPath = entrypointPath ?? Path.Combine(scriptsDirectory, "entrypoint.ps1");
        var environment = BuildEnvironment(runtimeCommand, workingDirectory, "windows");
        var commandLine = new List<string>
        {
            "-NoLogo",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            normalizedEntrypointPath,
            "-Runtime",
            runtimeCommand,
            "-WorkingDirectory",
            workingDirectory
        };

        if (runtimeArguments is { Count: > 0 })
        {
            foreach (var runtimeArgument in runtimeArguments)
            {
                commandLine.Add("-RuntimeArgument");
                commandLine.Add(runtimeArgument);
            }
        }

        return new WorkerRuntimeLaunchPlan(
            shellPath,
            normalizedEntrypointPath,
            runtimeCommand,
            workingDirectory,
            [.. commandLine],
            environment,
            runtimeArguments);
    }

    private static IReadOnlyDictionary<string, string> BuildEnvironment(
        string runtimeCommand,
        string workingDirectory,
        string entrypointPlatform)
    {
        return new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["CT_RUNTIME_COMMAND"] = runtimeCommand,
            ["CT_WORKING_DIRECTORY"] = workingDirectory,
            ["CT_RUNTIME_ENTRYPOINT_PLATFORM"] = entrypointPlatform,
        };
    }

    private static void EnsureEntrypointExists(string entrypointPath)
    {
        if (!File.Exists(entrypointPath))
        {
            throw new FileNotFoundException($"Worker runtime entrypoint '{entrypointPath}' was not found.", entrypointPath);
        }
    }

    private static string ResolveUnixShell()
    {
        var configuredShell = Environment.GetEnvironmentVariable("WORKER_RUNTIME_UNIX_SHELL")
            ?? Environment.GetEnvironmentVariable("WORKER_RUNTIME_SHELL");

        return ResolveCommand(
            [configuredShell, "/bin/bash", "/bin/zsh", "/bin/sh", "bash", "zsh", "sh"],
            isWindows: false,
            "No unix shell was found for worker runtime bootstrap. Checked bash, zsh, and sh.");
    }

    private static string ResolveWindowsShell()
    {
        var configuredShell = Environment.GetEnvironmentVariable("WORKER_RUNTIME_WINDOWS_SHELL")
            ?? Environment.GetEnvironmentVariable("WORKER_RUNTIME_SHELL");

        return ResolveCommand(
            [configuredShell, "pwsh.exe", "powershell.exe", "pwsh", "powershell"],
            isWindows: true,
            "No PowerShell runtime was found for worker runtime bootstrap. Checked pwsh and powershell.");
    }

    private static string ResolveCommand(IEnumerable<string?> candidates, bool isWindows, string failureMessage)
    {
        foreach (var candidate in candidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            var resolved = TryResolveCommand(candidate.Trim(), isWindows);
            if (!string.IsNullOrWhiteSpace(resolved))
            {
                return resolved;
            }
        }

        throw new FileNotFoundException(failureMessage);
    }

    private static string? TryResolveCommand(string candidate, bool isWindows)
    {
        if (Path.IsPathRooted(candidate) || candidate.Contains(Path.DirectorySeparatorChar) || candidate.Contains(Path.AltDirectorySeparatorChar))
        {
            return File.Exists(candidate) ? candidate : null;
        }

        var pathValue = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(pathValue))
        {
            return candidate;
        }

        var pathExtensions = isWindows
            ? (Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT;.PS1")
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            : [string.Empty];

        foreach (var pathSegment in pathValue.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var basePath = Path.Combine(pathSegment, candidate);
            if (File.Exists(basePath))
            {
                return basePath;
            }

            foreach (var extension in pathExtensions)
            {
                var candidatePath = string.IsNullOrWhiteSpace(extension) || basePath.EndsWith(extension, StringComparison.OrdinalIgnoreCase)
                    ? basePath
                    : basePath + extension;

                if (File.Exists(candidatePath))
                {
                    return candidatePath;
                }
            }
        }

        return null;
    }
}