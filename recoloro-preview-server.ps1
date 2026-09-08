<#
  Starts the local Recoloro preview server in the foreground.
  This script is intentionally run by the Windows scheduled task, not by hand.
#>

$ErrorActionPreference = 'Stop'

$websiteRoot = Split-Path -Parent $PSCommandPath
$python = 'C:\Users\dforr\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$server = Join-Path $websiteRoot 'local-pilot-server.py'

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw "Die lokale Python-Laufzeit wurde nicht gefunden: $python"
}

if (-not (Test-Path -LiteralPath $server -PathType Leaf)) {
    throw "Der Recoloro-Pilotserver wurde nicht gefunden: $server"
}

Set-Location -LiteralPath $websiteRoot
& $python $server
exit $LASTEXITCODE
