#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "============================================"
echo "  VulnArk - Docker Compose Deploy"
echo "============================================"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found. Install Docker first."
  exit 1
fi

echo "[1/3] Building image..."
docker compose build --no-cache

echo "[2/3] Starting containers..."
docker compose up -d

echo "[3/3] Waiting for service..."
sleep 20
docker compose ps
echo "--- health check ---"
curl -sS http://localhost:82/health || true
echo
echo "============================================"
echo "  Open: http://localhost:82"
echo "  Admin credentials: cmd/admin_credentials.txt"
echo "============================================"
