AI 终端管理应用：Cortex Terminal 详细架构与开发文档 (强制中继模式)

Cortex Terminal 采用类 Tailscale DERP 的分层网络架构，基于 .NET 10 实现。其核心思想是“控制面引导，数据面强制中继”，构建一个安全、可审计的加密运维网格，专门用于调度 codex、opencode、claude code 及 gemini cli 等 AI Agent。

1. 项目愿景 (Vision)

构建一个“全时在线、深度审计”的分布式终端网格。所有流量强制通过中心加密网关（Relay）中转，解决复杂企业内网环境下无法 P2P 打洞的问题，同时确保 AI 运维过程中的每一条指令、每一个字节都在可控的安全链条中运行。

2. 技术栈 (Tech Stack)

Central Relay & Control (中心中继与控制面): ASP.NET Core SignalR + .NET 10 高性能流式转发

Encrypted Tunnel (加密隧道): 基于 NodeKey 的端到端加密 (E2EE) 负载，承载于 WebSocket/SignalR 管道

Mobile (移动端): .NET MAUI Hybrid + React + xterm.js

Worker (节点端): .NET 10 Console Service + Pty.Net

AI Agents: claude-code, gemini, codex, opencode

3. 架构深度解析 (Relay-Centric Architecture)

3.1 核心组件设计

系统参照 Tailscale 的 DERP 模式，但在数据平面强制实施中继：

Central Relay Hub (中心中继枢纽):

控制职责: 负责手机端与 Worker 端的身份认证、设备指纹校验及会话映射。

中继职责: 充当流量转接站。它接收来自手机端的加密二进制流，并根据 SessionID 精准投递给对应的 Worker。网关仅处理“包裹”的路由，不解密“包裹”内容。

Edge Nodes (边缘节点):

Mobile Client: 作为指令发起方，负责将用户输入加密并封装进 SignalR 流。

Worker Node: 托管 AI Agent，持续维护与网关的长连接，接收中继流量并驱动本地 PTY。

3.2 强制中继通讯流 (Communication Flow)

建立连接: Worker 启动并连接至 Relay，报告其托管的 Agent 状态。

建立会话: 手机端登录，通过 Relay 选择目标 Worker 并申请开启 Agent Session。

流式交互:

手机端输入 -> 经 NodeKey 加密 -> 通过 SignalR Channel 发送至 Relay -> Relay 转发给 Worker。

Worker 执行结果 -> 存入本地 RingBuffer -> 经 NodeKey 加密 -> 通过 SignalR Channel 发回 Relay -> Relay 转发给手机端。

无缝重连: 手机端断网后，Relay 保持会话上下文，重连后立即补发 Relay 堆栈中的未读数据。

4. 三级认证与信任链 (Triple-Layer Trust)

L1 (Identity): OIDC 身份登录 + 移动端生物识别（FaceID/指纹）。

L2 (Relay Auth): 手机与 Worker 接入网关时需验证设备特征码（DeviceFingerprint）与 JWT。

L3 (E2EE): 手机与 Worker 之间建立端到端加密。即便网关（Relay）被入侵，攻击者由于没有 NodeKey，也无法解密终端指令或 AI 的返回内容。

5. 会话管理与 Agent 托管

5.1 增强型 Session 管理

Persistent PTY: Agent 进程在 Worker 上独立于网络连接运行。

RingBuffer (2000 Lines): Worker 本地保留 ANSI 全彩色日志缓存。

Gateway Relay Buffer: 网关端为每个活跃 Session 提供微型滑动窗口缓存，确保在手机重连的瞬间，数据传输能够“无缝接流”。

5.2 Agent 调度逻辑

Worker 端通过驱动 claude-code 等 CLI 工具，利用 PTY 捕获技术，实现对 AI 思考过程、进度条、交互式确认框的完整还原。

6. 开发者执行清单 (Copilot Instructions)

请按顺序引导 Copilot 生成代码：

生成中心中继 Hub:

"Create an ASP.NET Core SignalR Hub in .NET 10 as a 'Relay Server'. Implement a high-performance binary streaming relay using IAsyncEnumerable<byte[]> to route encrypted terminal traffic between Mobile clients and Worker nodes based on SessionID."

生成中继模式 Worker:

"Implement a .NET 10 Worker service that connects to the Relay Hub. Use Pty.Net to manage AI Agent processes. Implement a 2000-line RingBuffer and ensure it can push a 'Full Snapshot' to the Relay when a Mobile client reconnects."

生成 React 终端 UI (中继驱动):

"Build a React terminal UI using xterm.js. Implement logic to send and receive binary frames through the SignalR Relay Hub. Add a session-recovery handler that requests the latest buffer snapshot upon reconnection."

文档版本：v1.7.0 | 品牌名称：Cortex Terminal
