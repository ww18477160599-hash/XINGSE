@echo off
cd /d "%~dp0"
title XingSe Studio

where node >nul 2>nul
if errorlevel 1 (
    echo [XingSe Error] Node.js is not found! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

netstat -ano | findstr 127.0.0.1:3721 | findstr LISTENING >nul 2>nul
if errorlevel 1 (
    start "XingSeBackend" /min node server.js
    ping 127.0.0.1 -n 2 >nul
)

set "EDGE_EXE="
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe"

if defined EDGE_EXE (
    start "" "%EDGE_EXE%" --app=http://127.0.0.1:3721 --window-size=1540,960
) else (
    start http://127.0.0.1:3721
)
