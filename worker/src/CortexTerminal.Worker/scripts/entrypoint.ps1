param(
    [Parameter(Mandatory = $false)]
    [string]$Runtime = $env:CT_RUNTIME_COMMAND,

    [Parameter(Mandatory = $false)]
    [string]$WorkingDirectory = $env:CT_WORKING_DIRECTORY,

    [Parameter(Mandatory = $false)]
    [string[]]$RuntimeArgument = @()
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Runtime)) {
    Write-Host "__ct_error__:worker runtime entrypoint 缺少 runtime 参数。"
    exit 64
}

if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) {
    if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
        Write-Host "__ct_error__:working directory '$WorkingDirectory' 不存在。"
        exit 72
    }

    Set-Location -LiteralPath $WorkingDirectory
}

$runtimeCommand = Get-Command -Name $Runtime -ErrorAction SilentlyContinue
if ($null -eq $runtimeCommand) {
    Write-Host "__ct_error__:runtime '$Runtime' 尚未安装在当前 worker。请先安装并完成登录后重试。"
    exit 127
}

& $Runtime @RuntimeArgument
exit $LASTEXITCODE