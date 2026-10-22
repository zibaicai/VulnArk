@echo off
cd /d "%~dp0.."
set ROOT=%CD%

echo ============================================
echo   VulnArk - Start in background (hidden)
echo   Safe to close this window afterwards
echo ============================================

if not exist "%ROOT%\vulnark.exe" (
  echo [0/2] vulnark.exe not found, building ...
  go build -o vulnark.exe ./cmd
  if errorlevel 1 (
    echo [X] Build failed
    pause
    exit /b 1
  )
)

echo [1/2] Killing leftover process ...
taskkill /f /im vulnark.exe >nul 2>&1

echo [2/2] Starting in background ...
powershell -NoProfile -Command "Start-Process -FilePath '%ROOT%\vulnark.exe' -WorkingDirectory '%ROOT%' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%\vulnark.log' -RedirectStandardError '%ROOT%\vulnark.err.log'"

timeout /t 3 /nobreak >nul

echo.
echo --------------------------------------------
echo   Logs : %ROOT%\vulnark.log
echo   Err  : %ROOT%\vulnark.err.log
echo   URL  : http://localhost:82
echo   Stop : deploy\stop.bat
echo --------------------------------------------
pause
