# Cortex Terminal Engineering Standards

## Why this exists

这个项目已经有明确架构，但当前实现仍带有明显 MVP / demo 痕迹。为了让仓库朝“大项目”演进，后续新增代码和重构都要遵循本文件，而不是继续把逻辑堆进 `App.tsx` 或 `Program.cs`。

## Current review findings

截至当前这轮 review，几个高风险热点已经很明显：

- `mobile/src/App.tsx` 约 **814** 行：UI composition、terminal lifecycle、SignalR session、protocol recovery、输入交互都混在一起。
- `worker/src/CortexTerminal.Worker/Program.cs` 约 **447** 行：bootstrap、worker reconnect loop、Claude session orchestration、PTY I/O、protocol relay 混在一起。
- 命名整体可运行，但仍偏 MVP：部分对象更像“临时状态容器”，而非稳定 domain model。

这不代表实现错误，而是说明当前代码**可用但不够可演进**。

## Architecture goals

项目演进目标不是“把 demo 写大”，而是“把系统拆成可维护模块”。

### 1. Composition root only

- `mobile/src/App.tsx`：只负责 app shell、provider、route/view composition。
- `gateway/.../Program.cs`：只负责 DI、middleware、endpoint mapping。
- `worker/.../Program.cs`：只负责 startup、dependency graph、host lifecycle。

凡是 transport、protocol、state machine、session orchestration、PTY lifecycle 之类逻辑，都不应长期停留在 composition root。

### 2. Separate by responsibility

#### Mobile

推荐目标结构：

- `src/app/`：app shell、providers、global wiring
- `src/features/terminal/`：terminal feature folder
- `src/features/session/`：session selection / connection state
- `src/components/`：可复用 UI components
- `src/hooks/`：custom hooks (`useTerminalSession`, `useXterm`, `useRelayConnection`)
- `src/features/*/store/`：feature-scoped state stores（推荐 Zustand for shared frontend state）
- `src/lib/`：pure adapters / infrastructure clients
- `src/types/`：shared frontend types

#### Gateway

推荐目标结构：

- `Hubs/`：SignalR hub endpoints only
- `Services/Sessions/`：session registry / binding services
- `Services/Routing/`：relay routing / validation
- `Contracts/`：hub message contracts / DTOs
- `Extensions/`：service registration / startup extensions

#### Worker

推荐目标结构：

- `Services/Relay/`：gateway client + reconnect handling
- `Services/Sessions/`：session coordinator / runtime registry
- `Services/Pty/`：PTY factory / stream pumps / terminal input writer
- `Services/Protocol/`：control frame parsing (`__ct_init__`, `__ct_ready__`, `__ct_error__`)
- `Models/`：`ClaudeSession`, session metadata, worker runtime state
- `HostedServices/`：long-running worker background loops

## Naming standards

## General rules

- 名称必须表达职责，不表达“临时感觉”。
- 优先使用 domain-oriented names，而不是 implementation-colored names。
- 避免含糊命名：`manager`, `helper`, `utils`, `data`, `temp`, `misc`, `commonStuff`。

## Good examples

- `SessionBindingRegistry`
- `RelayConnectionState`
- `ClaudeSessionCoordinator`
- `TerminalInputBar`
- `useTerminalSession`
- `TerminalTransportClient`

## Bad examples

- `Helper`
- `AppStateManager`
- `DataUtil`
- `DoConnect`
- `handleThing`
- `tempSession`

## File size and cohesion rules

- 软上限：多数文件控制在 **300 行以内**。
- 超过 **500 行** 视为明确的重构信号。
- 一个文件中如果同时出现以下任意三类以上职责，就必须拆分：
  - UI rendering
  - state management
  - network transport
  - protocol parsing
  - retry/reconnect logic
  - domain orchestration
  - persistence/cache

## React standards

- 页面组件负责 layout，不负责协议细节。
- 复杂交互放入 hooks，不直接堆在 page component。
- local-only UI state（如 input focus、hover、modal open）保留在 component/hook 内。
- cross-view / cross-session / reconnect-sensitive state 使用集中式 store；前端默认推荐 **Zustand**，但 store 必须按 feature 划分，不能做成一个全局万能 store。
- Zustand store 只负责 state + actions，不负责直接操作 DOM、xterm 实例或网络实现细节。
- store 命名使用 `useXxxStore`，文件放在 feature 内，例如 `features/terminal/store/useTerminalSessionStore.ts`。
- 不要把所有 state 都塞进 Zustand；temporary form state、单组件动画状态、纯展示状态继续用 React local state。
- 硬编码 demo 数据必须迁移到 fixtures、mock adapters 或 config。
- xterm lifecycle 必须封装到独立 hook/service，避免散落在 page body。
- 发送命令、session rebind、ready/error control frames 需要统一收口到 terminal/session feature 层。

## .NET standards

- `Program.cs` 只做 bootstrap。
- 可测试逻辑移入 class/service，不写成 top-level giant script。
- 与外部系统交互（SignalR、PTY、CLI）必须有独立 adapter/service。
- session lifecycle、relay routing、protocol parsing 分开建模，不混在单个函数链里。

## Testing standards

- 每个 feature folder / service folder 都要有对应测试落点。
- 重点覆盖：
  - session binding / rebind
  - reconnect continuity
  - control frame parsing
  - PTY input normalization
  - terminal UI focus + mount lifecycle

## Anti-demo checklist

出现以下任意情况时，视为“项目正在退化成 demo”：

- 新需求继续直接加进 `App.tsx`
- 新 runtime 逻辑继续直接加进 `Program.cs`
- 协议字符串散落在多个文件中，无统一 parser/constants
- 页面里直接持有 transport client、state machine、UI rendering 全套逻辑
- 所有前端状态继续堆在一个 page component，或者反过来全部塞进一个无边界的 Zustand store
- 模块 README 与实际目录脱节
- 命名风格在不同模块中不一致

## Refactor priority order

建议后续演进按下面顺序推进：

1. **Mobile first**
   - 拆 `App.tsx` 为 app shell、terminal feature、session feature、hooks、components
2. **Worker second**
   - 拆 `Program.cs` 为 relay client、session coordinator、PTY I/O service、protocol handler
3. **Gateway third**
   - 保持 hub 薄层，逐步把 session binding / routing policy 抽到 service 层
4. **Shared contracts**
   - 将 control frame / protocol constants 显式化，减少 magic strings

## Definition of done for new features

一个 feature 只有在满足以下条件时，才算达到“大项目标准”：

- 放在正确模块目录
- 命名清晰、可搜索
- 不扩大 monolithic file
- 有测试落点
- README / docs 如有结构变化则同步更新
- 不破坏 relay-only、session continuity、xterm-only、no-fallback 基因
