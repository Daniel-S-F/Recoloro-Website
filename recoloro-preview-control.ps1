<#
  Local control for the scheduled Recoloro preview server.
  Examples:
    .\recoloro-preview-control.ps1 -Action Start
    .\recoloro-preview-control.ps1 -Action Status
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Start', 'Stop', 'Restart', 'Open', 'Status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$taskName = 'Recoloro Website-Vorschau'
$previewUrl = 'http://127.0.0.1:4173/'

function Get-PreviewReachable {
    try {
        $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Start-PreviewTask {
    schtasks.exe /Run /TN $taskName | Out-Null
    Start-Sleep -Seconds 1
}

function Stop-PreviewTask {
    schtasks.exe /End /TN $taskName | Out-Null
}

switch ($Action) {
    'Start' {
        Start-PreviewTask
        if (Get-PreviewReachable) {
            Write-Output "Recoloro-Vorschau läuft: $previewUrl"
        }
        else {
            Write-Error 'Der Start wurde ausgelöst, die Vorschau antwortet aber noch nicht. Bitte Status prüfen.'
        }
    }
    'Stop' {
        Stop-PreviewTask
        Write-Output 'Recoloro-Vorschau wurde gestoppt.'
    }
    'Restart' {
        Stop-PreviewTask
        Start-Sleep -Milliseconds 500
        Start-PreviewTask
        if (Get-PreviewReachable) {
            Write-Output "Recoloro-Vorschau läuft wieder: $previewUrl"
        }
        else {
            Write-Error 'Der Neustart wurde ausgelöst, die Vorschau antwortet aber noch nicht. Bitte Status prüfen.'
        }
    }
    'Open' {
        if (-not (Get-PreviewReachable)) {
            Start-PreviewTask
        }
        Start-Process $previewUrl
    }
    'Status' {
        $task = schtasks.exe /Query /TN $taskName /FO LIST 2>&1
        $reachable = Get-PreviewReachable
        Write-Output $task
        Write-Output ("Vorschau erreichbar: {0}" -f $(if ($reachable) { 'Ja' } else { 'Nein' }))
    }
}
