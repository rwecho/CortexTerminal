# Project Guidelines

## Scope

These instructions apply to the whole workspace. Use this file as the single workspace-level instruction source.

## Language Style

- Prefer **中英混合** in discussions and docs (Chinese-first with key technical English terms).
- Keep identifiers and code symbols in English; narrative can be Chinese.

## Architecture

Cortex Terminal is a relay-centric AI terminal mesh (forced relay mode), inspired by DERP-style design.

- **Central Relay Hub**: Auth/session mapping + encrypted binary traffic relay (does not decrypt payloads)
- **Mobile Client**: session initiator, terminal UI, encrypted stream producer/consumer
- **Worker Node**: hosts AI CLI agents, manages PTY lifecycle, returns terminal stream

For full architecture and security model, see `readme.md`.

## Repository Layout

- `gateway/`: Relay Hub and control-plane routing implementation.
- `worker/`: AI CLI runtime, PTY lifecycle, RingBuffer/session snapshot.
- `mobile/`: MAUI Hybrid + React terminal client implementation.
- `docs/`: project structure and additional design/engineering docs.

When implementing features, place code in the correct module directory and avoid cross-module leakage.

For target folder conventions and engineering rules, follow `docs/PROJECT-STRUCTURE.md` and `docs/ENGINEERING-STANDARDS.md`.

## Coding Conventions

- Prefer **.NET 10** for Relay/Worker code and **SignalR streaming** for transport.
- Keep data plane behavior relay-only unless task explicitly changes architecture.
- Preserve **SessionID-based routing** and **E2EE assumptions** when implementing features.
- For terminal output state, keep reconnect-friendly design (RingBuffer/snapshot approach).
- Mobile terminal rendering is **xterm-only** (`@xterm/xterm`); do **not** add text/DOM fallback terminal rendering paths.
- When generating user-facing docs or comments in this repo, prefer **Chinese** to match existing docs.
- Treat `Program.cs` and `App.tsx` as composition roots, **not** as long-term homes for business logic.
- Avoid single-file feature growth. If a file starts holding UI, state, transport, protocol handling, and domain rules together, split it immediately.
- Prefer feature folders + layer separation over dumping helpers into one file.
- New types/functions must use professional, intention-revealing names. Avoid vague names like `data`, `manager`, `helper`, `temp`, `misc`, `util1`, `handleStuff`.
- Soft limit: keep most source files under ~300 lines; if a file exceeds ~500 lines, treat it as a required refactor signal unless there is a strong reason.
- React: keep page composition, hooks, protocol adapters, and presentational components separate. `App.tsx` should wire routes/providers/layout only.
- Frontend state strategy: use local React state only for ephemeral UI state; use a dedicated store layer for cross-view/session state. If Zustand is introduced, keep stores in feature-scoped `store/` folders and avoid embedding business rules directly in components.
- Gateway/Worker: keep startup/bootstrap in `Program.cs`, move runtime orchestration into dedicated services, session coordinators, protocol handlers, and hosted services.
- Tests should mirror runtime structure so every new service/hook/protocol adapter has an obvious test location.
- Do not add fallback behavior, polling recovery, degraded-mode paths, or similar “兜底” logic to the mainline product flow unless the user explicitly asks for that specific strategy. Fix the primary path first; no self-directed resilience features.

## Build and Test

Current workspace is architecture-first and may not yet contain runnable projects.

When code is scaffolded, infer commands from actual files (`*.sln`, `*.csproj`, `package.json`) and then run:

- .NET build/test for Relay/Worker modules
- Frontend install/build/test for React terminal UI

Do not invent project paths or scripts that are not present.

## Agent Behavior

- Follow "link, don’t embed": reference `readme.md` instead of duplicating architecture text.
- Implement incrementally: Relay Hub → Worker service → React terminal UI.
- Validate assumptions against repository files before making structural changes.
- If new files are added, prefer module-local docs (`gateway/README.md`, `worker/README.md`, `mobile/README.md`) over large root-level duplication.
- When reviewing or extending the project, actively push it away from demo-style patterns and toward product-grade structure.
- Prefer small, cohesive files with explicit ownership boundaries over quick inline implementations.
- If an existing file is already oversized, do not keep adding logic into it unless the task is an emergency fix.

## Pitfalls

- Reconnection logic is a core requirement; avoid losing session continuity.
- PTY integration must preserve interactive AI CLI behavior (progress bars, prompts, ANSI output).
- If terminal UI output is blank, fix xterm lifecycle/mount/flush race directly; do not introduce fallback renderers.
- Security chain is layered (Identity / Relay Auth / E2EE); avoid weakening any layer during refactors.
- Demo smell to avoid: giant `App.tsx`, giant `Program.cs`, mixed protocol/UI logic, hard-coded sample data living in production paths, and inconsistent naming across modules.
