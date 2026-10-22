#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "============================================"
echo "  VulnArk - Local (no Docker) Deploy"
echo "  Requires: Go 1.24+ and MySQL 8 running"
echo "============================================"

if ! command -v go >/dev/null 2>&1; then
  echo "[ERROR] go not found. Install: https://go.dev/dl/"
  exit 1
fi

echo "[0/3] GOPROXY -> goproxy.cn"
go env -w GOPROXY=https://goproxy.cn,direct

echo "[1/3] Downloading modules..."
go mod download

echo "[2/3] Building..."
go build -o vulnark ./cmd

echo "[3/3] Starting server on http://localhost:82 ..."
echo "       Config: configs/config.yaml (MySQL root/root@123 - change if needed)"
echo "============================================"
exec ./vulnark
