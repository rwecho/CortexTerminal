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
$uninstallPath = Join-Path $InstallDir "uninstall-worker.ps1"
$packageVersionFile = Join-Path $packageRoot "package-version.txt"
$installedVersionFile = Join-Path $InstallDir "package-version.txt"

function Read-VersionFile([string]$Path) {
    if (-not (Test-Path $Path)) {
        return $null
    }

    return (Get-Content -Path $Path -Raw).Trim()
}

function Normalize-PackageVersion([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return $Value.Trim().TrimStart('v')
}

function Compare-PackageVersion([string]$IncomingVersion, [string]$InstalledVersion) {
    $incomingNormalized = Normalize-PackageVersion $IncomingVersion
    $installedNormalized = Normalize-PackageVersion $InstalledVersion

    if ([string]::IsNullOrWhiteSpace($incomingNormalized) -or [string]::IsNullOrWhiteSpace($installedNormalized)) {
        return 'Unknown'
    }

    if ($incomingNormalized -eq $installedNormalized) {
        return 'Same'
    }

    $incomingParsed = $null
    $installedParsed = $null
    if ([Version]::TryParse($incomingNormalized, [ref]$incomingParsed) -and [Version]::TryParse($installedNormalized, [ref]$installedParsed)) {
        $comparison = $incomingParsed.CompareTo($installedParsed)
        if ($comparison -gt 0) {
            return 'Newer'
        }

        if ($comparison -lt 0) {
            return 'Older'
        }

        return 'Same'
    }

    return 'Unknown'
}

$packageVersion = Read-VersionFile $packageVersionFile
$installedVersion = Read-VersionFile $installedVersionFile
switch (Compare-PackageVersion $packageVersion $installedVersion) {
    'Same' {
        Write-Host "Worker version $packageVersion is already installed at $InstallDir."
        Write-Host 'Skipping reinstall.'
        return
    }
    'Older' {
        throw "Refusing to downgrade worker from $installedVersion to $packageVersion."
    }
}

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

if (Test-Path $packageVersionFile) {
    Copy-Item $packageVersionFile $installedVersionFile -Force
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

$uninstaller = @'
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$UninstallArgs
)

$ErrorActionPreference = "Stop"

$installDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$uninstallScript = Join-Path $installDir "bin/scripts/uninstall-worker.ps1"

if (-not (Test-Path $uninstallScript)) {
    throw "Worker uninstall script was not found: $uninstallScript"
}

& $uninstallScript -InstallDir $installDir @UninstallArgs
exit $LASTEXITCODE
'@

Set-Content -Path $uninstallPath -Value $uninstaller -Encoding UTF8

Write-Host "Worker installed successfully."
Write-Host "Install directory: $InstallDir"
Write-Host "Environment file : $envFile"
Write-Host "Launcher         : $launcherPath"
Write-Host "Uninstall        : $uninstallPath"
if (-not [string]::IsNullOrWhiteSpace($packageVersion)) {
    Write-Host "Package version  : $packageVersion"
}
if (Test-Path (Join-Path $binDir "tools/nssm/nssm.exe")) {
    Write-Host "Bundled NSSM     : $(Join-Path $binDir 'tools/nssm/nssm.exe')"
}
Write-Host "Next steps:"
Write-Host "  1. Edit $envFile"
Write-Host "  2. Run: pwsh -File $launcherPath"
Write-Host "  3. Remove: pwsh -File $uninstallPath"
