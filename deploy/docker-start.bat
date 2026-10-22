@echo off
chcp 65001 >nul
cd /d "%~dp0.."

echo ============================================
echo   VulnArk - Docker Compose Deploy
echo ============================================

docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker not found. Install Docker Desktop first.
    echo         https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [1/3] Building image...
docker compose build --no-cache
if errorlevel 1 goto fail

echo [2/3] Starting containers...
docker compose up -d
if errorlevel 1 goto fail

echo [3/3] Waiting for service to be ready...
timeout /t 20 /nobreak >nul

echo.
echo --- container status ---
docker compose ps
echo.
echo --- health check ---
curl -s http://localhost:82/health
echo.
echo ============================================
echo   Open: http://localhost:82
echo   Admin credentials: cmd\admin_credentials.txt
echo ============================================
pause
exit /b 0

:fail
echo [ERROR] Deploy failed. Showing logs:
docker compose logs --tail 60
pause
exit /b 1
