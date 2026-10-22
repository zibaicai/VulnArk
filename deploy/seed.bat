@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ============================================
echo   VulnArk - Import demo data
echo   Usage: seed.bat            (skip if data exists)
echo          seed.bat --force    (clear and re-import)
echo ============================================

go run ./cmd/seed %*
if errorlevel 1 (
  echo.
  echo [X] Import failed. Check MySQL connection and configs/config.yaml
)
pause
