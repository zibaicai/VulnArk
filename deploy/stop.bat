@echo off
echo Stopping VulnArk ...
taskkill /f /im vulnark.exe 2>nul
if errorlevel 1 (
  echo No running vulnark process found
) else (
  echo Stopped
)
timeout /t 2 /nobreak >nul
