@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $d = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut(\"$d\形色 XINGSE (便携经典版).lnk\"); $s.TargetPath = Join-Path $PSScriptRoot '形色.exe'; $s.WorkingDirectory = $PSScriptRoot; $s.IconLocation = (Join-Path $PSScriptRoot 'app.ico') + ',0'; $s.Description = '形色 XINGSE 便携经典版'; $s.Save(); Write-Host '[OK] 桌面快捷方式创建成功！'"
ping 127.0.0.1 -n 3 >nul
