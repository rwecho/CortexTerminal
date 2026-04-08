# Mobile 模块（Client App）

`mobile` contains React terminal client code plus a .NET MAUI native shell host powered by `HybridWebView`.

## 责任范围 Responsibilities

- 会话发起与交互 UI（session initiation + terminal UX）
- 输入输出流加解密（E2EE producer/consumer）
- 断线重连与快照恢复（session recovery）

## 目录约定 Structure

- `src/`: React terminal client source code
- `maui/`: .NET MAUI native shell host
- `tests/`: Mobile tests (UI/unit/e2e as needed)

## 边界 Boundary

- 不直接执行 AI CLI
- 不持有跨节点路由状态（由 gateway 管理）

## MVP 已实现 Implemented

- React + Vite terminal UI prototype
- .NET MAUI `HybridWebView` shell for Android / iOS / Mac Catalyst host embedding
- Gateway connection controls (gateway URL / worker ID / session ID)
- Command relay send + worker stream display
- Mock mode for deterministic UI E2E tests
- Playwright e2e test (`playwright/tests/mobile-ui.spec.ts`)

## 本地运行 Run locally

- Install dependencies:
  - `cd mobile && npm install`
- Run UI:
  - `cd mobile && npm run dev -- --host 127.0.0.1 --port 4173`
- Build MAUI shell web assets:
  - `cd mobile && npm run build:maui-shell`
- Build MAUI shell (example on macOS):
  - `cd mobile && dotnet build ./maui/CortexTerminal.MobileShell/CortexTerminal.MobileShell.csproj -f net10.0-maccatalyst`
- Run Playwright e2e:
  - `cd mobile && npm run test:e2e`

## MAUI shell notes

- React static assets are copied into `maui/CortexTerminal.MobileShell/Resources/Raw/wwwroot`.
- The native host serves the packaged web app through `HybridWebView` with `HybridRoot="wwwroot"` and `DefaultFile="index.html"`.
- Packaged shell uses relative asset paths, so Vite `base` is set to `./`.
- Browser/dev mode keeps standard SPA routing; MAUI packaged mode switches to hash routing automatically when it detects the native host environment.

## GitHub Actions 发布 Publish automation

- GitHub Actions:
  - `.github/workflows/mobile-publish.yml`
- 发布模式参考 `V2ex.Maui2`：
  - 先在 Linux job 构建 React web artifact
  - 再在 macOS job 下载 artifact 并 publish MAUI shell
- 当前支持：
  - Android artifact (`.aab` / `.apk`)
  - Mac Catalyst artifact
  - 可选 iOS signed IPA（需手动触发并配置签名 secrets）
- 建议 secrets：
  - Android:
    - `ANDROID_KEYSTORE_BASE64`
    - `ANDROID_KEYSTORE_PASSWORD`
    - `ANDROID_KEY_PASSWORD`
    - `ANDROID_KEY_ALIAS`
  - iOS:
    - `APPLE_CERTIFICATES_P12_BASE64`
    - `APPLE_CERTIFICATES_P12_PASSWORD`
    - `APPLE_PROVISIONING_PROFILE_BASE64`
    - `APPLE_SIGNING_IDENTITY`
    - `APPLE_PROVISIONING_PROFILE_NAME`
