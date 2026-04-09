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

- 推荐安装方式（对终端用户 only one path）:
  - 登录 mobile，进入 `安装 Worker`
  - 生成安装命令
  - 按电脑平台复制对应 one-liner：
    - macOS / Linux：`curl -fsSL 'https://<gateway>/install-worker.sh?token=<iwk_token>' | bash`
    - Windows：`powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "& ([ScriptBlock]::Create((Invoke-WebRequest -UseBasicParsing 'https://<gateway>/install-worker.ps1?token=<iwk_token>').Content))"`
  - 脚本会下载最新 worker release，并对比安装包里的 `package-version.txt` 与当前已安装版本；如果发现更高版本则执行升级，如果版本相同则跳过重复安装。
  - 升级时会尽量保留现有 `worker.env` 中的 `WORKER_ID`、`WORKER_DISPLAY_NAME`、`WORKER_USER_KEY` 等身份配置；Linux 会更新同一个 `systemd --user` service，macOS 会更新同一个 `launchd` agent，Windows 会更新同一个 Windows Service。

- GitHub Actions:
  - `.github/workflows/worker-package.yml` 会产出 `linux-x64`、`osx-arm64`、`win-x64` 三个平台安装包。
- 安装包内容：
  - self-contained worker executable
  - `scripts/install-worker.sh`
  - `scripts/install-worker.ps1`
  - `scripts/worker.env.example`
  - `package-version.txt`
  - Windows 额外包含 `tools/nssm/nssm.exe`
  - package root 会包含 `THIRD_PARTY_NOTICES.md`
- 服务管理：
  - Linux：安装后由 `systemd --user` 管理 Worker 生命周期。
  - macOS：安装后由 `launchd` LaunchAgent 管理 Worker 生命周期。
  - Windows：安装后由 NSSM 注册的 Windows Service 管理 Worker 生命周期。
