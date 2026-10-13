$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# 1. Check Node.js
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "[XingSe Error] Node.js is not installed. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 2. Check if port 3721 is already running
$portListening = $false
try {
    $conns = Get-NetTCPConnection -LocalPort 3721 -State Listen -ErrorAction SilentlyContinue
    if ($conns) { $portListening = $true }
} catch {}

if (-not $portListening) {
    Write-Host "[XingSe] Starting local backend service on port 3721..." -ForegroundColor Cyan
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $ScriptDir -WindowStyle Hidden
    Start-Sleep -Milliseconds 800
} else {
    Write-Host "[XingSe] Service is already running on port 3721." -ForegroundColor Green
}

# 3. Locate Edge or Chrome for app window
$browserPaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$targetBrowser = $null
foreach ($bPath in $browserPaths) {
    if (Test-Path $bPath) {
        $targetBrowser = $bPath
        break
    }
}

$url = "http://127.0.0.1:3721"
if ($targetBrowser) {
    Write-Host "[XingSe] Opening application window..." -ForegroundColor Green
    Start-Process -FilePath $targetBrowser -ArgumentList "--app=$url --window-size=1540,960"
} else {
    Start-Process $url
}
