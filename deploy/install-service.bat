@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set TASK=VulnArk

echo ============================================
echo   VulnArk - Install auto-start on boot
echo   (Windows Task Scheduler, no extra tools)
echo ============================================

net session >nul 2>&1
if errorlevel 1 (
  echo [X] Please run this script as Administrator
  echo     ^(right click -^> Run as administrator^)
  pause
  exit /b 1
)

if not exist "%ROOT%\vulnark.exe" (
  echo [0/3] Building vulnark.exe ...
  go build -o vulnark.exe ./cmd
  if errorlevel 1 (
    echo [X] Build failed
    pause
    exit /b 1
  )
)

echo [1/3] Stopping old process ...
taskkill /f /im vulnark.exe >nul 2>&1

echo [2/3] Creating scheduled task ^(SYSTEM, runs without login^) ...
schtasks /create /tn "%TASK%" /tr "\"%ROOT%\deploy\run.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f
if errorlevel 1 (
  echo [X] Failed to create task
  pause
  exit /b 1
)

echo [3/3] Starting once now ...
schtasks /run /tn "%TASK%"
timeout /t 3 /nobreak >nul

echo.
echo --------------------------------------------
echo   Auto-start installed. Starts on boot.
echo   Check now : http://localhost:82
echo   Stop      : deploy\stop.bat
echo   Uninstall : deploy\uninstall-service.bat
echo   Logs      : %ROOT%\vulnark.log
echo --------------------------------------------
pause
