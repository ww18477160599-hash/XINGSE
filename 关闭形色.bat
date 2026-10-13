@echo off
cd /d "%~dp0"
title XingSe Close

powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 3721) } | Stop-Process -Force"
echo [XingSe] Service on port 3721 has been stopped.
ping 127.0.0.1 -n 2 >nul
