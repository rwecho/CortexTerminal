param(
    [string]$InstallDir = $(if ($env:CORTEX_WORKER_INSTALL_DIR) { $env:CORTEX_WORKER_INSTALL_DIR } else { Join-Path $HOME ".cortex-terminal/worker" }),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageRoot = Split-Path -Parent $scriptDir
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
$binDir = Join-Path $InstallDir "bin"
$configDir = Join-Path $InstallDir "config"
$envTemplate = Join-Path $packageRoot "scripts/worker.env.example"
$envFile = Join-Path $configDir "worker.env"
$launcherPath = Join-Path $InstallDir "run-worker.ps1"

if ((Test-Path $binDir) -and -not $Force) {
    $existingEntries = Get-ChildItem -Force $binDir -ErrorAction SilentlyContinue
    if ($existingEntries.Count -gt 0) {
        throw "Install target already contains files: $binDir. Re-run with -Force to replace the existing worker payload."
    }
}

if (Test-Path $binDir) {
    Remove-Item -Recurse -Force $binDir
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $packageRoot "*") $binDir

if (-not (Test-Path $envFile)) {
    Copy-Item $envTemplate $envFile
}

$launcher = @'
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$WorkerArgs
)

$ErrorActionPreference = "Stop"

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = if ($env:CORTEX_WORKER_ENV_FILE) { $env:CORTEX_WORKER_ENV_FILE } else { Join-Path $installDir "config/worker.env" }

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^[\s#]' -or [string]::IsNullOrWhiteSpace($_)) {
            return
        }

        $parts = $_ -split '=', 2
        if ($parts.Length -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0], $parts[1])
        }
    }
}

$binDir = Join-Path $installDir "bin"
$exePath = Join-Path $binDir "CortexTerminal.Worker.exe"
$dllPath = Join-Path $binDir "CortexTerminal.Worker.dll"

if (Test-Path $exePath) {
    & $exePath @WorkerArgs
    exit $LASTEXITCODE
}

dotnet $dllPath @WorkerArgs
exit $LASTEXITCODE
'@

Set-Content -Path $launcherPath -Value $launcher -Encoding UTF8

Write-Host "Worker installed successfully."
Write-Host "Install directory: $InstallDir"
Write-Host "Environment file : $envFile"
Write-Host "Launcher         : $launcherPath"
Write-Host "Next steps:"
Write-Host "  1. Edit $envFile"
Write-Host "  2. Run: pwsh -File $launcherPath"
