<#
  Installs or renews the local Recoloro preview environment for the current Windows user.
  It creates a logon task and four desktop shortcuts. No network or live server is involved.
#>

$ErrorActionPreference = 'Stop'

$websiteRoot = Split-Path -Parent $PSCommandPath
$controlScript = Join-Path $websiteRoot 'recoloro-preview-control.ps1'
$serverScript = Join-Path $websiteRoot 'recoloro-preview-server.ps1'
$taskName = 'Recoloro Website-Vorschau'

foreach ($path in @($controlScript, $serverScript)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Erforderliche Datei fehlt: $path"
    }
}

$argument = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$serverScript`""
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 3650)

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description 'Lokale Recoloro-Webvorschau auf http://127.0.0.1:4173/' `
    -Force | Out-Null

$shell = New-Object -ComObject WScript.Shell
$desktop = $shell.SpecialFolders.Item('Desktop')
$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"

# Remove only shortcuts created by an earlier run of this installer. This also
# corrects legacy Windows PowerShell's handling of non-ASCII shortcut names.
Get-ChildItem -LiteralPath $desktop -Filter 'Recoloro *.lnk' | ForEach-Object {
    $existingShortcut = $shell.CreateShortcut($_.FullName)
    if ($existingShortcut.Arguments -like '*recoloro-preview-control.ps1*') {
        Remove-Item -LiteralPath $_.FullName
    }
}

$shortcutDefinitions = @(
    @{ Name = 'Recoloro Website oeffnen'; Action = 'Open'; Description = 'Oeffnet die lokale Recoloro-Webvorschau.' },
    @{ Name = 'Recoloro Server neu starten'; Action = 'Restart'; Description = 'Startet die lokale Recoloro-Webvorschau neu.' },
    @{ Name = 'Recoloro Server stoppen'; Action = 'Stop'; Description = 'Stoppt die lokale Recoloro-Webvorschau.' },
    @{ Name = 'Recoloro Server Status'; Action = 'Status'; Description = 'Zeigt den Status der lokalen Recoloro-Webvorschau.' }
)

foreach ($definition in $shortcutDefinitions) {
    $shortcut = $shell.CreateShortcut((Join-Path $desktop "$($definition.Name).lnk"))
    $shortcut.TargetPath = $powershell
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$controlScript`" -Action $($definition.Action)"
    $shortcut.WorkingDirectory = $websiteRoot
    $shortcut.Description = $definition.Description
    $shortcut.WindowStyle = if ($definition.Action -eq 'Open') { 7 } else { 1 }
    $shortcut.Save()
}

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 1

try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ne 200) {
        throw "Unerwarteter HTTP-Status: $($response.StatusCode)"
    }
}
catch {
    throw "Die Aufgabe wurde eingerichtet, aber die Vorschau ist noch nicht erreichbar: $($_.Exception.Message)"
}

Write-Output 'Recoloro-Vorschau eingerichtet und erreichbar: http://127.0.0.1:4173/'
