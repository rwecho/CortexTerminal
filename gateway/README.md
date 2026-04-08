# Gateway 模块（Relay Hub）

`gateway` is the control + relay entry of Cortex Terminal.

## 责任范围 Responsibilities

- 认证与会话映射（auth + session mapping）
- 二进制流中继（binary relay via SignalR）
- SessionID 路由，不解密业务负载（route only, no payload decryption）

## 目录约定 Structure

- `src/`: Gateway source code
- `tests/`: Gateway unit/integration tests

## 边界 Boundary

- 不承担 AI CLI 执行
- 不承担终端 UI 渲染
- 默认保持 forced-relay 模式（no P2P bypass）

## MVP 已实现 Implemented

- SignalR Hub endpoint: `/hubs/relay`
- Health endpoint: `/health`
- Worker/Mobile session registry (in-memory)
- PostgreSQL-backed user/session/worker metadata
- Redis-backed worker/session live presence cache
- Management APIs:
  - `GET/POST /api/users`
  - `GET/POST /api/workers`
  - `POST /api/workers/{workerId}/heartbeat`
  - `GET/POST /api/sessions`
  - `POST /api/sessions/{sessionId}/bind`
  - `POST /api/sessions/{sessionId}/close`

## 本地运行 Run locally

- Run gateway:
  - `ASPNETCORE_URLS=http://localhost:5050 dotnet run --project gateway/src/CortexTerminal.Gateway`
- Required infrastructure env vars:
  - `GATEWAY_POSTGRES_CONNECTION_STRING`
  - `GATEWAY_REDIS_CONNECTION_STRING`
- Run tests:
  - `dotnet test gateway/tests/CortexTerminal.Gateway.Tests/CortexTerminal.Gateway.Tests.csproj`

## Docker 发布 Docker publishing

- GitHub Actions:
  - `.github/workflows/gateway-docker-publish.yml`
- 发布目标：
  - `ghcr.io/<owner>/cortex-terminal-gateway`
- 默认触发：
  - `main` 分支 gateway 相关改动
  - `v*` tag
  - 手动 `workflow_dispatch`
- 标签策略：
  - branch
  - git tag
  - commit sha
  - default branch 上的 `latest`
