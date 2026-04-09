# Worker 模块（Agent Runtime）

`worker` hosts AI CLI processes and PTY lifecycle.

## 责任范围 Responsibilities

- 托管 AI Agent CLI（claude-code / codex / gemini / opencode）
- PTY 生命周期管理（interactive terminal behavior）
- RingBuffer 缓存与快照回传（reconnect-friendly snapshot）

## 目录约定 Structure

- `src/`: Worker source code
- `tests/`: Worker unit/integration tests

## 边界 Boundary

- 不实现移动端 UI
- 不承担中心路由控制逻辑（由 gateway 负责）

## MVP 已实现 Implemented

- SignalR relay client with auto reconnect
- Worker registration (`RegisterWorker`)
- 2000-line RingBuffer core implementation
- Echo-style command response path for end-to-end validation

## 本地运行 Run locally

- Run worker:
  - `GATEWAY_BASE_URL=http://localhost:5050 WORKER_ID=worker-1 dotnet run --project worker/src/CortexTerminal.Worker`
- Run tests:
  - `dotnet test worker/tests/CortexTerminal.Worker.Tests/CortexTerminal.Worker.Tests.csproj`

## 打包与安装 Package + install

- Gateway one-liner install（推荐）:
  - 登录 mobile 后生成 install command
  - 在电脑执行：`curl -fsSL 'https://<gateway>/install-worker.sh?token=<iwk_token>' | bash`
  - 脚本会下载最新 worker release、写默认 `worker.env`、并直接启动 worker

- GitHub Actions:
  - `.github/workflows/worker-package.yml` 会产出 `linux-x64`、`osx-arm64`、`win-x64` 三个平台安装包。
- 安装包内容：
  - self-contained worker executable
  - `scripts/install-worker.sh`
  - `scripts/install-worker.ps1`
  - `scripts/worker.env.example`
- Unix/macOS 安装：
  - 解压后执行 `./scripts/install-worker.sh --install-dir ~/.cortex-terminal/worker --force`
- Windows 安装：
  - 解压后执行 `pwsh -File .\scripts\install-worker.ps1 -InstallDir "$HOME/.cortex-terminal/worker" -Force`
- 安装完成后：
  - 编辑 `config/worker.env`
  - 使用生成的 `run-worker.sh` 或 `run-worker.ps1` 启动 worker
