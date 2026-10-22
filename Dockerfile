# ---------- 构建阶段 ----------
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /src

# 先拷依赖清单，利用 Docker 层缓存
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0：MySQL 驱动为纯 Go 实现，无需 cgo，产物可直接跑在 alpine
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/vulnark ./cmd

# ---------- 运行阶段 ----------
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata curl \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app

COPY --from=builder /out/vulnark /app/vulnark
COPY configs /app/configs
COPY web     /app/web
RUN mkdir -p /app/uploads

EXPOSE 82

# 上传文件、配置、日志建议挂出来持久化
VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:82/health || exit 1

ENTRYPOINT ["/app/vulnark"]
