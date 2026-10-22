# VulnArk 部署与启动指南（Go 直接跑，不用 Docker）

> 适用：已装好 **Go 1.24+** 和 **MySQL 8.0** 的机器（Windows / Linux 通用）

---

## 一、前置条件

| 依赖 | 版本要求 | 检查命令 | 说明 |
|---|---|---|---|
| Go | ≥ 1.24（go.mod 里 toolchain 是 1.24.2） | `go version` | 低版本会自动尝试下载 toolchain，内网会卡住 |
| MySQL | **8.0**（必须） | `mysql -uroot -p -e "select version()"` | 代码用了 `information_schema` / `SHOW INDEX` 等 MySQL 专用语法，**不能换 SQLite** |
| 端口 | 82（默认） | `netstat -ano \| findstr 82` | 被占用就改 `configs/config.yaml` |

---

## 二、数据库准备

**好消息：不用手动建表。** 服务启动时会自动完成：建库 → 建表 → 建角色/权限 → 生成管理员。

你只需要保证配置里的账号能连上 MySQL。推荐建一个专用账号：

```sql
CREATE DATABASE vulnark CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vulnark'@'%' IDENTIFIED BY 'VulnArk@2026';
GRANT ALL PRIVILEGES ON vulnark.* TO 'vulnark'@'%';
FLUSH PRIVILEGES;
```

---

## 三、改配置（部署前必看 3 处）

文件：`configs/config.yaml`

```yaml
server:
  port: "82"          # ① 端口，被占用就换（比如 8080）
  mode: "release"     # 生产保持 release；排错时临时改 debug

database:
  host: "localhost"   # MySQL 地址
  port: 3306
  username: "root"    # ② 换成你自己的账号
  password: "root@123"  # ② 换成你自己的密码

jwt:
  secret: "ky6oJtR8..."  # ③ 部署前务必换掉（openssl rand -base64 48）
```

---

## 四、启动（三种方式，选一个）

### 方式 A：一键脚本（最省事）

```bash
# Windows：双击 或 命令行
deploy\start.bat

# Linux / macOS
bash deploy/start.sh
```

脚本会依次做：检查 Go → 设国内代理 → 拉依赖 → 编译 → 启动。

### 方式 B：手动命令（第一次建议用这个，能完整看到日志）

```bash
cd /d/你的目录/VulnArk          # 一定要进项目根目录

go env -w GOPROXY=https://goproxy.cn,direct    # 国内加速
go mod download                                 # 拉依赖（首次约 1-3 分钟）
go build -o vulnark.exe ./cmd                   # Windows 编译（Linux 去掉 .exe）
vulnark.exe                                     # 启动
```

### 方式 C：开发模式（改代码后热跑，不生成 exe）

```bash
go run ./cmd
```

> ⚠️ **最大的坑：必须在项目根目录执行！**
> 代码里 `./configs`、`./web` 都是**相对路径**。如果你 `cd cmd` 再跑，会报"配置文件读取失败"，即使跑起来前端也是白屏。

---

## 五、访问与登录

启动成功的日志长这样：

```
🎉 VulnArk 系统已就绪！
📋 管理员账号信息：
   👤 用户名: admin
   🔑 密  码: xxxxxxxxxxxxxxxx   ← 随机生成，就这一次
🌐 访问地址:
   • http://localhost:82
```

- 打开 **http://localhost:82**
- 账号 `admin`，密码看**终端日志**，或看项目根目录自动生成的 `admin_credentials.txt`

> ⚠️ 密码是**首次启动时随机生成**的。如果日志刷过去了没看到，就打开项目根目录的 `admin_credentials.txt`。
> 仓库里那个 `cmd/admin_credentials.txt` 是历史遗留的旧文件，**不是**你这次的密码，可以删掉避免混淆。

**想重置管理员密码**：删库重来最简单 ——
```bash
mysql -uroot -p -e "DROP DATABASE vulnark;"
vulnark.exe     # 重启后重新初始化，生成新密码
```

---

## 六、导入演示数据（366 资产 / 340 漏洞）

新装的库是空的，只有账号和角色。想让平台一上来就有内容可展示，跑一次种子导入：

```bash
go run ./cmd/seed            # 已有数据则自动跳过
go run ./cmd/seed --force    # 清空资产和漏洞后重新导入
```

Windows 双击 **`deploy\seed.bat`**，Linux 用 `bash deploy/seed.sh`。

导入内容：

| 类型 | 数量 | 说明 |
|---|---|---|
| 人员 | 14 | 安全部/运维部/研发中心/财务部/数据部，统一初始密码 `VulnArk@2026` |
| 资产 | 366 | 20 个业务系统，含公司、所属系统、环境、IP/域名/端口、OS、中间件、框架、指纹、负责人 |
| 漏洞 | 340 | 严重/高危/中危/低危，含 CVE/CNVD、CVSS、OWASP 分类、发现方式、复现步骤、修复建议、状态与负责人 |
| OWASP | 10 | A01~A10 分类 |

- 数据**直接写进 MySQL**，导入一次就永久保留，重启服务不会丢
- 漏洞的 `intel_id` 会一并写入，所以「点漏洞名 → 跳到漏洞资料看描述和修复建议」在真后端同样有效
- 想恢复出厂：`go run ./cmd/seed --force`

> ⚠️ 加了新的展示字段（指纹/环境/漏洞类型/intel_id），**seed 会自动补列**。如果是老库，跑一次 seed 即可，不用手动改表。

**正确顺序**（顺序错了会看不到指纹这些新字段）：

```bash
1. 停掉正在跑的 vulnark 服务（Ctrl+C）
2. go run ./cmd/seed --force     # 补列 + 灌数据
3. go build -o vulnark.exe ./cmd  # 重新编译（带新字段的 struct）
4. vulnark.exe                    # 启动
5. 浏览器 Ctrl+F5 强刷
```

> ⚠️ **必须先重新编译再启动**。正在运行的老进程用的是编译时的旧 struct，读不出新加的列，前端指纹那一列会是空的。

---

## 七、常见问题排查

| 现象 | 原因 | 解决办法 |
|---|---|---|
| `MySQL服务器连接失败` / `配置文件读取失败` | MySQL 没启动、账号密码不对、或没在根目录跑 | 先 `mysql -uroot -p` 验证能连；确认命令行在**项目根目录** |
| 启动后页面白屏 / 404 | 前端 `web/` 目录没被读到 | 检查工作目录；确认 `web/index.html` 存在 |
| `bind: address already in use` | 82 端口被占 | 改 `config.yaml` 的 port，或 `netstat -ano \| findstr 82` 找出占用进程杀掉 |
| `go: ... toolchain not available` | Go 版本太低 | 升级到 1.24+，别让它自动下载 toolchain |
| 依赖下载超时 / 卡住 | 没走国内代理 | `go env -w GOPROXY=https://goproxy.cn,direct` |
| 登录一直 401 | JWT 密钥变更或缓存 | 重新登录；必要时清浏览器 token |
| 上传的截图打不开 | 上传目录未挂载 | 已修复（`main.go` 里挂了 `/uploads`），重新编译即可 |
| 局域网其他电脑访问不了 | 防火墙没放行 | 见第七节 |

---

## 七、局域网 / 双机访问

配置里 `server.host: ""` 表示监听 `0.0.0.0`，所以其他机器用 IP 就能访问：

1. 查本机 IP：`ipconfig`（比如 192.168.1.50）
2. 放行防火墙（管理员 PowerShell 执行一次即可）：
   ```powershell
   New-NetFirewallRule -DisplayName "VulnArk-82" -Direction Inbound -LocalPort 82 -Protocol TCP -Action Allow
   ```
3. 另一台机器浏览器打开：`http://192.168.1.50:82`

> 跨网段（教室 ↔ 宿舍）走 **Tailscale / ZeroTier** 组虚拟局域网，用虚拟 IP 访问，不用在公网暴露端口。

---

## 八、让它后台常驻（别开着窗口）

### Windows

| 脚本 | 作用 |
|---|---|
| `deploy\start-hidden.bat` | 后台隐藏启动，关掉窗口也不停（零依赖，立即可用） |
| `deploy\stop.bat` | 停止服务 |
| `deploy\install-service.bat` | 注册**开机自启**（用系统自带 schtasks，无需下载任何工具，需管理员运行） |
| `deploy\uninstall-service.bat` | 取消开机自启 |

```powershell
# 只想后台跑（不重启电脑也生效）
deploy\start-hidden.bat

# 想开机自动起来：右键管理员运行
deploy\install-service.bat
```

日志会写到项目根目录 `vulnark.log`（正常）和 `vulnark.err.log`（错误），看不到终端时用这俩排查。

> 想用 NSSM 注册成标准 Windows 服务也可以（崩溃自动重启更稳）：
> ```
> nssm install VulnArk "D:\VulnArk\vulnark.exe"
> nssm set VulnArk AppDirectory "D:\VulnArk"
> nssm start VulnArk
> ```

### Linux（systemd）

```ini
# /etc/systemd/system/vulnark.service
[Unit]
Description=VulnArk
After=mysql.service

[Service]
WorkingDirectory=/opt/vulnark
ExecStart=/opt/vulnark/vulnark
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now vulnark
sudo journalctl -u vulnark -f     # 看日志
```

---

## 九、上线前安全清单

- [ ] 换掉 `jwt.secret`（`openssl rand -base64 48`）
- [ ] MySQL 不用 root，改用专用账号 + 强密码
- [ ] `server.mode: release`
- [ ] 登录后立刻改 admin 密码，**删除 `admin_credentials.txt`**
- [ ] `cors.allowed_origins` 从 `*` 改成具体域名
- [ ] MySQL 别开 3306 到公网
- [ ] 配 Nginx 反代 + HTTPS（可选）

---

## 附：Docker 方式（可选，非必须）

如果你哪天想在服务器上一条命令起，项目里已经备好了：

```bash
docker compose up -d --build     # 起 MySQL 8 + 应用
docker compose logs -f app       # 看日志（含管理员密码）
```

访问 http://localhost:82。配置文件是 `deploy/config.docker.yaml`（数据库地址指向 `mysql` 服务名）。
