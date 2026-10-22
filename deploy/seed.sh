#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "============================================"
echo "  VulnArk - 导入演示数据"
echo "  用法: ./seed.sh            (已有数据则跳过)"
echo "        ./seed.sh --force    (清空后重新导入)"
echo "============================================"

go run ./cmd/seed "$@"
