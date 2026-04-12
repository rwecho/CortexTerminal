using System.Diagnostics;

namespace CortexTerminal.Worker.Tests;

public sealed class WorkerRuntimeEntrypointTests
{
    [Fact]
    public async Task UnixEntrypoint_WithoutRuntimeArguments_ExecutesRuntimeWithoutCrashing()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        using var harness = WorkerRuntimeEntrypointHarness.Create();

        var result = await harness.RunAsync("/bin/pwd");

        Assert.Equal(0, result.ExitCode);
        Assert.Equal($"{harness.WorkingDirectory}{Environment.NewLine}", result.StandardOutput);
        Assert.Equal(string.Empty, result.StandardError);
    }

    [Fact]
    public async Task UnixEntrypoint_WithRuntimeArguments_ForwardsAllArguments()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        using var harness = WorkerRuntimeEntrypointHarness.Create();

        var result = await harness.RunAsync("/bin/echo", "--resume", "session-123", "--fork-session");

        Assert.Equal(0, result.ExitCode);
        Assert.Equal($"--resume session-123 --fork-session{Environment.NewLine}", result.StandardOutput);
        Assert.Equal(string.Empty, result.StandardError);
    }

    private sealed class WorkerRuntimeEntrypointHarness : IDisposable
    {
        private readonly string rootDirectory;

        private WorkerRuntimeEntrypointHarness(string rootDirectory, string entrypointPath, string workingDirectory)
        {
            this.rootDirectory = rootDirectory;
            EntrypointPath = entrypointPath;
            WorkingDirectory = workingDirectory;
        }

        public string EntrypointPath { get; }
        public string WorkingDirectory { get; }

        public static WorkerRuntimeEntrypointHarness Create()
        {
            var rootDirectory = Path.Combine(Path.GetTempPath(), $"cortex-worker-entrypoint-tests-{Guid.NewGuid():N}");
            var workingDirectory = Path.Combine(rootDirectory, "workspace");
            Directory.CreateDirectory(workingDirectory);

            var entrypointPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../src/CortexTerminal.Worker/scripts/entrypoint.sh"));

            return new WorkerRuntimeEntrypointHarness(rootDirectory, entrypointPath, workingDirectory);
        }

        public async Task<ProcessResult> RunAsync(string runtimeCommand, params string[] runtimeArguments)
        {
            var processStartInfo = new ProcessStartInfo("bash")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
            };

            processStartInfo.ArgumentList.Add(EntrypointPath);
            processStartInfo.ArgumentList.Add("--runtime");
            processStartInfo.ArgumentList.Add(runtimeCommand);
            processStartInfo.ArgumentList.Add("--working-directory");
            processStartInfo.ArgumentList.Add(WorkingDirectory);

            foreach (var runtimeArgument in runtimeArguments)
            {
                processStartInfo.ArgumentList.Add("--runtime-arg");
                processStartInfo.ArgumentList.Add(runtimeArgument);
            }

            using var process = Process.Start(processStartInfo)
                ?? throw new InvalidOperationException("Failed to start worker runtime entrypoint test process.");

            var standardOutputTask = process.StandardOutput.ReadToEndAsync();
            var standardErrorTask = process.StandardError.ReadToEndAsync();

            await process.WaitForExitAsync();

            return new ProcessResult(
                process.ExitCode,
                await standardOutputTask,
                await standardErrorTask);
        }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(rootDirectory))
                {
                    Directory.Delete(rootDirectory, recursive: true);
                }
            }
            catch
            {
                // ignore cleanup failures in tests
            }
        }
    }

    private sealed record ProcessResult(int ExitCode, string StandardOutput, string StandardError);
}