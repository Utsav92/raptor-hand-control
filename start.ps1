$ErrorActionPreference = 'Stop'
$raptorRoot = $PSScriptRoot
$raptorUrl = 'http://localhost:54821/'
try {
    $raptorResponse = Invoke-WebRequest -Uri $raptorUrl -UseBasicParsing -TimeoutSec 2
    $raptorRunning = $raptorResponse.Content -like '*Raptor*left-hand control*'
} catch {
    $raptorRunning = $false
}
if (-not $raptorRunning) {
    $raptorPython = (Get-Command python -ErrorAction Stop).Source
    Start-Process -FilePath $raptorPython -ArgumentList @('"' + (Join-Path $raptorRoot 'serve.py') + '"') -WorkingDirectory $raptorRoot -WindowStyle Hidden
    Start-Sleep -Milliseconds 750
}
Start-Process $raptorUrl
