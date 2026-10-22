@echo off
echo Stopping process and removing auto-start task ...
taskkill /f /im vulnark.exe >nul 2>&1
schtasks /delete /tn "VulnArk" /f 2>nul
if errorlevel 1 (
  echo Auto-start task not found
) else (
  echo Auto-start task removed
)
pause
