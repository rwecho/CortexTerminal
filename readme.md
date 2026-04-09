<div align="center">

# Cortex Terminal

**Secure AI Terminal Manager**

全时在线、深度审计的分布式终端网格，统一调度 Claude Code、Gemini CLI、Codex、OpenCode 等 AI Agent。

[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet)](https://dot.net)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![MAUI](https://img.shields.io/badge/MAUI-Hybrid-512BD4?logo=dotnet)](https://dot.net)
[![License](https://img.shields.io/badge/License-Private-red)](LICENSE)

</div>

---

## 架构

Cortex Terminal 采用类 Tailscale DERP 的**强制中继架构**。所有流量通过中心加密网关中转，网关仅路由加密数据包，不解密内容。

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Mobile     │◄─E2EE──►│  Gateway (Relay)  │◄─E2EE──►│   Worker     │
│  MAUI+React  │ SignalR │  ASP.NET Core 10  │ SignalR │  .NET 10     │
│  xterm.js    │         │  PostgreSQL+Redis  │         │  Pty.Net     │
└──────────────┘         └──────────────────┘         └──────────────┘
                               │
                          AI Agents
                    claude-code / gemini
                    codex / opencode
```

## 核心特性

- **强制中继** — 所有流量经加密网关路由，可审计可追溯
- **端到端加密** — NodeKey E2EE，网关被入侵也无法解密
- **三级认证** — OIDC + 设备指纹 + E2EE 分层信任链
- **无缝重连** — 断网后 Relay 保持会话，重连立即补发
- **多 Agent** — 统一调度 claude-code、gemini、codex、opencode
- **完整渲染** — PTY 捕获 AI 思考过程、进度条、交互确认框

## 技术栈

| 组件        | 技术                                                         |
| ----------- | ------------------------------------------------------------ |
| **Gateway** | ASP.NET Core 10, SignalR, PostgreSQL, Redis, OpenIddict      |
| **Worker**  | .NET 10, Pty.Net, SignalR Client                             |
| **Mobile**  | .NET MAUI Hybrid, React 19, xterm.js, Vite 7, Tailwind CSS 4 |
| **CI/CD**   | GitHub Actions (Android, iOS, Mac Catalyst)                  |

## 项目结构

```
CortexTerminal/
├── gateway/                    # 中心中继网关
│   └── src/CortexTerminal.Gateway/
│       ├── Hubs/               # RelayHub, ManagementHub
│       ├── Services/           # Auth, Relay, Sessions, Workers, Audit
│       └── Data/               # EF Core + PostgreSQL
├── worker/                     # 边缘节点 (AI Agent 宿主)
│   └── src/CortexTerminal.Worker/
│       ├── Services/           # PTY 管理, RingBuffer, 会话调度
│       └── scripts/            # Agent 启动脚本
├── mobile/                     # 移动端
│   ├── src/                    # React 终端 UI
│   │   ├── features/           # auth, terminal, sessions, settings
│   │   └── lib/                # SignalR 客户端, 网关通信
│   └── maui/                   # .NET MAUI 原生 Shell
├── .github/workflows/          # CI/CD
└── global.json                 # .NET SDK 10.0.103
```

## 快速开始

### 前置要求

- .NET SDK 10.0.103+
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 配置

```bash
# .env
GATEWAY_BASE_URL=http://localhost:5050
GATEWAY_POSTGRES_CONNECTION_STRING=Host=localhost;Port=5432;Database=cortex;Username=...;Password=...
GATEWAY_REDIS_CONNECTION_STRING=localhost:6379
WORKER_ID=worker-1
VITE_GATEWAY_BASE_URL=http://localhost:5050
```

### 启动

```bash
# Gateway
cd gateway/src/CortexTerminal.Gateway && dotnet run

# Worker
cd worker/src/CortexTerminal.Worker && dotnet run

# Mobile (开发)
cd mobile && npm install && npm run dev -- --host 127.0.0.1 --port 4173
```

### Worker 接入（推荐）

对终端用户，推荐只保留一种 onboarding 方式：

1. 在 mobile 中进入 `安装 Worker`
2. 生成一条安装命令
3. 根据目标电脑的平台复制对应命令完成安装与首次启动

#### 可复制的安装脚本

macOS / Linux:

```bash
curl -fsSL 'https://gateway.ct.rwecho.top/install-worker.sh?token=<iwk_token>' | bash
```

Windows:

```powershell
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Invoke-WebRequest -UseBasicParsing 'https://gateway.ct.rwecho.top/install-worker.ps1?token=<iwk_token>').Content))"
```

#### 安装脚本会做什么

- 自动下载最新 worker release
- 自动比较 `package-version.txt` 与本机当前已安装版本
- 如果发现更高版本，则执行 upgrade
- 如果版本相同，则跳过重复安装
- Linux 会注册并启动 `systemd --user` Worker service
- macOS 会注册并启动 `launchd` Worker agent
- Windows 会使用随包一起下发的 `nssm.exe`，并将 worker 注册为 Windows Service 后启动

#### 再次执行脚本时的行为

- **same version**：跳过，不重复安装
- **higher version**：升级，并保留现有 `WORKER_ID` / `WORKER_DISPLAY_NAME` / `WORKER_USER_KEY`
- **lower version**：拒绝 downgrade，避免误覆盖

如果你是在本地开发或调试 worker 代码，仍可直接进入 `worker/src/CortexTerminal.Worker` 执行 `dotnet run`

### 构建 MAUI Shell

```bash
cd mobile && npm run build:maui-shell

# iOS
dotnet build ./maui/CortexTerminal.MobileShell/CortexTerminal.MobileShell.csproj -f net10.0-ios

# Android
dotnet build ./maui/CortexTerminal.MobileShell/CortexTerminal.MobileShell.csproj -f net10.0-android
```

### 测试

```bash
dotnet test gateway/tests/
dotnet test worker/tests/
cd mobile && npm run test:e2e
```

## 安全

```
┌─────────────────────────────┐
│  L1: OIDC + Face ID/Touch ID │
├─────────────────────────────┤
│  L2: DeviceFingerprint + JWT │
├─────────────────────────────┤
│  L3: E2EE (NodeKey)          │
└─────────────────────────────┘
```

## CI/CD

| Workflow                     | 产物                                   |
| ---------------------------- | -------------------------------------- |
| `gateway-docker-publish.yml` | Docker image                           |
| `worker-package.yml`         | NuGet package                          |
| `mobile-publish.yml`         | Android AAB/APK, iOS IPA, Mac Catalyst |

## License

Private — All rights reserved.
