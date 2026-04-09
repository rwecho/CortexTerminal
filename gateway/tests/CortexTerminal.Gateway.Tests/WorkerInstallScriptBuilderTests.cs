using CortexTerminal.Gateway.Extensions;

namespace CortexTerminal.Gateway.Tests;

public sealed class WorkerInstallScriptBuilderTests
{
    [Fact]
    public void BuildCommandSet_ReturnsUnixAndWindowsBootstrapCommands()
    {
        var commandSet = WorkerInstallScriptBuilder.BuildCommandSet(
            "https://gateway.ct.rwecho.top",
            "iwk_TEST123");

        Assert.Equal(
            "https://gateway.ct.rwecho.top/install-worker.sh?token=iwk_TEST123",
            commandSet.UnixUrl);
        Assert.Equal(
            "https://gateway.ct.rwecho.top/install-worker.ps1?token=iwk_TEST123",
            commandSet.WindowsUrl);
        Assert.Equal(
            "curl -fsSL 'https://gateway.ct.rwecho.top/install-worker.sh?token=iwk_TEST123' | bash",
            commandSet.UnixCommand);
        Assert.Contains("powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command", commandSet.WindowsCommand);
        Assert.Contains("install-worker.ps1?token=iwk_TEST123", commandSet.WindowsCommand);
    }

    [Fact]
    public void BuildUnixScript_UsesTarballBootstrap()
    {
        var script = WorkerInstallScriptBuilder.BuildUnixScript(
            "https://gateway.ct.rwecho.top",
            "iwk_TEST123");

        Assert.Contains("package-version.txt", script);
        Assert.Contains("compare_package_versions", script);
        Assert.Contains("refreshing managed service configuration", script);
        Assert.Contains("WORKER_DISPLAY_NAME", script);
        Assert.Contains("install_or_update_systemd_user_service", script);
        Assert.Contains("install_or_update_launchd_agent", script);
        Assert.Contains("systemctl --user", script);
        Assert.Contains("launchctl bootstrap", script);
        Assert.Contains("cortex-terminal-worker-linux-x64.tar.gz", script);
        Assert.Contains("cortex-terminal-worker-osx-arm64.tar.gz", script);
        Assert.Contains("scripts/install-worker.sh", script);
        Assert.Contains("run-worker.sh", script);
        Assert.Contains("--install-dir \"$install_dir\"", script);
    }

    [Fact]
    public void BuildWindowsScript_UsesZipAndPowerShellInstall()
    {
        var script = WorkerInstallScriptBuilder.BuildWindowsScript(
            "https://gateway.ct.rwecho.top",
            "iwk_TEST123");

        Assert.Contains("cortex-terminal-worker-win-x64.zip", script);
        Assert.Contains("Expand-Archive", script);
        Assert.Contains("scripts/install-worker.ps1", script);
        Assert.Contains("run-worker.ps1", script);
        Assert.Contains("Invoke-RestMethod", script);
        Assert.Contains("package-version.txt", script);
        Assert.Contains("Compare-PackageVersion", script);
        Assert.Contains("skipping upgrade", script);
        Assert.Contains("Resolve-NssmPath", script);
        Assert.Contains("bin/tools/nssm/nssm.exe", script);
        Assert.Contains("Install-OrUpdateNssmService", script);
        Assert.Contains("nssm.exe was not found", script);
        Assert.Contains("AppExit Default Restart", script);
        Assert.Contains("starting NSSM service", script);
    }
}