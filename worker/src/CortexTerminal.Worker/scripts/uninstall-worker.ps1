param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
)

$ErrorActionPreference = "Stop"

$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
$envFile = if ($env:CORTEX_WORKER_ENV_FILE) { $env:CORTEX_WORKER_ENV_FILE } else { Join-Path $InstallDir "config/worker.env" }

function Log([string]$Message) {
    Write-Host "[cortex-worker-uninstall] $Message"
}

function Read-EnvValue([string]$Path, [string]$Key) {
    if (-not (Test-Path $Path)) {
        return $null
    }

    foreach ($line in Get-Content -Path $Path) {
        if ($line -match '^[\s#]' -or [string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        $parts = $line -split '=', 2
        if ($parts.Length -eq 2 -and $parts[0] -eq $Key) {
            return $parts[1]
        }
    }

    return $null
}

function Resolve-NssmPath {
    $candidates = @(
        (Join-Path $InstallDir 'bin/tools/nssm/nssm.exe'),
        $env:CORTEX_WORKER_NSSM_PATH,
        'nssm.exe',
        'nssm'
    )

    foreach ($candidate in $candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }

        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }

    return $null
}

$workerName = Read-EnvValue -Path $envFile -Key 'WORKER_ID'
if (-not [string]::IsNullOrWhiteSpace($workerName)) {
    $serviceName = if ([string]::IsNullOrWhiteSpace($env:CORTEX_WORKER_WINDOWS_SERVICE_NAME)) { "CortexTerminalWorker-$workerName" } else { $env:CORTEX_WORKER_WINDOWS_SERVICE_NAME.Trim() }
    $nssmPath = Resolve-NssmPath
    if ($nssmPath) {
        Log "removing NSSM service $serviceName"
        & $nssmPath stop $serviceName | Out-Null 2>$null
        & $nssmPath remove $serviceName confirm | Out-Null 2>$null
    }
}

if (Test-Path $InstallDir) {
    Log "removing install directory $InstallDir"
    $command = "timeout /t 2 >nul & rmdir /s /q `"$InstallDir`""
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $command -WindowStyle Hidden
}

Log "worker uninstall scheduled"