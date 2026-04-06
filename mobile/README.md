# Mobile 模块（Client App）

`mobile` contains MAUI Hybrid + React terminal client code.

## 责任范围 Responsibilities

- 会话发起与交互 UI（session initiation + terminal UX）
- 输入输出流加解密（E2EE producer/consumer）
- 断线重连与快照恢复（session recovery）

## 目录约定 Structure

- `src/`: Mobile client source code
- `tests/`: Mobile tests (UI/unit/e2e as needed)

## 边界 Boundary

- 不直接执行 AI CLI
- 不持有跨节点路由状态（由 gateway 管理）

## MVP 已实现 Implemented

- React + Vite terminal UI prototype
- Gateway connection controls (gateway URL / worker ID / session ID)
- Command relay send + worker stream display
- Mock mode for deterministic UI E2E tests
- Playwright e2e test (`playwright/tests/mobile-ui.spec.ts`)

## 本地运行 Run locally

- Install dependencies:
  - `cd mobile && npm install`
- Run UI:
  - `cd mobile && npm run dev -- --host 127.0.0.1 --port 4173`
- Run Playwright e2e:
  - `cd mobile && npm run test:e2e`
