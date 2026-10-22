#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "============================================"
echo "  VulnArk  -  Go 直接启动（Linux / macOS）"
echo "============================================"

# 0. 检查 Go
if ! command -v go >/dev/null 2>&1; then
  echo "[X] 未检测到 Go，请先安装 Go 1.24+: https://go.dev/dl/"
  exit 1
fi
echo "[0/3] Go 版本: $(go version)"

# 1. 国内加速
go env -w GOPROXY=https://goproxy.cn,direct

# 2. 拉依赖
echo "[1/3] 下载依赖..."
go mod download

# 3. 编译
echo "[2/3] 编译..."
go build -o vulnark ./cmd

# 4. 启动（必须在项目根目录，configs/ 与 web/ 都是相对路径）
echo "[3/3] 启动服务  http://localhost:82"
echo "--------------------------------------------"
echo " 首次启动会随机生成管理员密码，请留意下面的日志输出"
echo " 密码同时保存在: ./admin_credentials.txt"
echo " Ctrl+C 停止服务"
echo "--------------------------------------------"
exec ./vulnark
