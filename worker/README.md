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
