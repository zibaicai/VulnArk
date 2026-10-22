@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ============================================
echo   VulnArk - Local (no Docker) Deploy
echo   Requires: Go 1.24+ and MySQL 8 running
echo ============================================

where go >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Go not found in PATH.
    echo         Install: https://go.dev/dl/  (go1.24.x windows-amd64.msi)
    pause
    exit /b 1
)

echo [0/3] GOPROXY -> goproxy.cn for faster module download
go env -w GOPROXY=https://goproxy.cn,direct

echo [1/3] Downloading modules...
go mod download
if errorlevel 1 goto fail

echo [2/3] Building...
go build -o vulnark.exe ./cmd
if errorlevel 1 goto fail

echo [3/3] Starting server on http://localhost:82 ...
echo        Config: configs\config.yaml  (MySQL root/root@123 - change if needed)
echo        Press Ctrl+C to stop.
echo ============================================
vulnark.exe
goto :eof

:fail
echo [ERROR] Build failed. Check Go/MySQL setup above.
pause
exit /b 1
