$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$url = "http://localhost:$port/"

Write-Host "Starting local server for Accounting Jeopardy..." -ForegroundColor Cyan
Write-Host "Project root: $projectRoot"
Write-Host "URL: $url"
Write-Host ""
Write-Host "Press Ctrl+C in this window to stop the server." -ForegroundColor Yellow

Start-Process $url

Set-Location $projectRoot
python -m http.server $port
