# Cortex Terminal Project Structure

## Why this structure

为了让 architecture 与实现边界保持一致，仓库采用按组件分层（mobile / gateway / worker）。

## Directory Layout

- `gateway/`：Relay Hub（control + binary relay）
- `worker/`：AI CLI runtime + PTY + RingBuffer
- `mobile/`：MAUI Hybrid + React terminal client
- `docs/`：结构、架构、开发规范文档

## Suggested build ownership

- Gateway team: `gateway/src`, `gateway/tests`
- Worker team: `worker/src`, `worker/tests`
- Mobile team: `mobile/src`, `mobile/tests`

## Guardrails

- Keep data plane relay-only unless explicitly redesigned.
- Keep SessionID routing stable across all modules.
- Keep reconnect path testable (snapshot + replay).
- Keep E2EE assumptions intact end-to-end.

## Next implementation order

1. `gateway` MVP (SignalR relay hub)
2. `worker` MVP (PTY + RingBuffer + reconnect snapshot)
3. `mobile` MVP (xterm.js + session recovery)

## Current delivery status

- `gateway` MVP: completed (hub + registry + tests)
- `worker` MVP: completed (relay client + RingBuffer + tests)
- `mobile` MVP: completed (React UI + Playwright e2e)

## Current maturity assessment

仓库已经跨过“只有架构图，没有代码”的阶段，但还没有进入真正的 product-grade structure。

当前最明显的 demo-style hotspots：

- `mobile/src/App.tsx` 过大，承载过多职责
- `worker/src/CortexTerminal.Worker/Program.cs` 承担 runtime orchestration 过多
- 部分 naming / folder layout 仍偏 MVP，而非 feature-oriented organization

这意味着：模块边界方向是对的，但模块**内部**还需要继续分层。

## Target structure for the next stage

### Mobile

```text
mobile/src/
  app/
  components/
  features/
    terminal/
      components/
      hooks/
      store/
      services/
      types/
    session/
      components/
      hooks/
      store/
      services/
      types/
  lib/
  styles/
```

### Gateway

```text
gateway/src/CortexTerminal.Gateway/
  Hubs/
  Services/
    Sessions/
    Routing/
  Contracts/
  Extensions/
```

### Worker

```text
worker/src/CortexTerminal.Worker/
  HostedServices/
  Models/
  Services/
    Relay/
    Sessions/
    Pty/
    Protocol/
```

详细规则见 `docs/ENGINEERING-STANDARDS.md`。

## Verified in this iteration

- Backend unit tests passed (`gateway`, `worker`)
- Playwright test passed (mock mode)
- Browser-driven real integration passed:
  - mobile connected to gateway
  - command relayed to worker
  - worker echo frame returned to UI
