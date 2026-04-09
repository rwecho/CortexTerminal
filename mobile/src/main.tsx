import "./features/native/bridge/hybridWebViewInterop";
import React from "react";
import { createRoot } from "react-dom/client";
import {
  bootstrapStartupConfig,
  isLikelyNativeShellHostRuntime,
  refreshStartupConfig,
  type StartupConfig,
} from "./features/native/startup/nativeStartup";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Unable to resolve root container for Cortex Terminal.");
}

const rootContainer = container;
const root = createRoot(rootContainer);
let hasRenderedApplication = false;
let renderApplicationPromise: Promise<void> | null = null;

type NativeInitEnvelope = {
  type?: string;
  payload?: Partial<StartupConfig>;
};

declare global {
  interface Window {
    initData?: Partial<StartupConfig>;
  }
}

rootContainer.innerHTML = `
  <div class="flex h-screen flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
    <div class="flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-600/30 bg-cyan-600/20">
      <div class="h-12 w-12 animate-pulse rounded-2xl bg-cyan-500/70"></div>
    </div>
    <div>
      <h1 class="text-2xl font-bold tracking-tighter italic">CORTEX TERMINAL</h1>
      <p class="mt-2 text-sm text-gray-500">正在同步 native startup config…</p>
    </div>
  </div>
`;

void initializeApplication();

function sendNativeLifecycleMessage(
  messageType: "appInit" | "appReady",
): boolean {
  try {
    const sendRawMessage = window.HybridWebView?.SendRawMessage;

    if (!sendRawMessage) {
      return false;
    }

    sendRawMessage(JSON.stringify({ type: messageType }));
    return true;
  } catch {
    return false;
  }
}

async function renderApplication(initialConfig?: Partial<StartupConfig>) {
  bootstrapStartupConfig(initialConfig);
  window.initData = initialConfig;

  if (hasRenderedApplication) {
    return;
  }

  if (renderApplicationPromise) {
    return renderApplicationPromise;
  }

  renderApplicationPromise = (async () => {
    try {
      const [{ default: App }, { AppRouter }] = await Promise.all([
        import("./App"),
        import("./features/app/components/AppRouter"),
      ]);

      root.render(
        <React.StrictMode>
          <AppRouter>
            <App />
          </AppRouter>
        </React.StrictMode>,
      );

      hasRenderedApplication = true;

      if (initialConfig) {
        sendNativeLifecycleMessage("appReady");
      }
    } catch (error) {
      console.error("[startup] Failed to render application shell.", error);
      rootContainer.innerHTML = `
        <div class="flex h-screen flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
          <h1 class="text-2xl font-bold tracking-tighter italic">CORTEX TERMINAL</h1>
          <p class="max-w-sm text-sm text-red-400">应用 shell 启动失败，请重新打开应用。</p>
        </div>
      `;
    } finally {
      renderApplicationPromise = null;
    }
  })();

  return renderApplicationPromise;
}

function renderWithNativeFallback() {
  void renderApplication({
    platform: "unknown",
    isNativeShell: true,
    useHashRouter: true,
  });
}

function hydrateNativeStartupConfig() {
  void refreshStartupConfig().then((config) => {
    window.initData = config;
  });
}

async function initializeApplication() {
  if (!isLikelyNativeShellHostRuntime()) {
    await renderApplication();
    return;
  }

  const initDataHandler = (event: Event) => {
    const customEvent = event as CustomEvent<{ message?: unknown }>;
    const rawMessage = customEvent.detail?.message;

    if (!rawMessage) {
      return;
    }

    try {
      const data =
        typeof rawMessage === "string"
          ? (JSON.parse(rawMessage) as NativeInitEnvelope)
          : (rawMessage as NativeInitEnvelope);

      if (data.type !== "initData") {
        return;
      }

      window.removeEventListener(
        "HybridWebViewMessageReceived",
        initDataHandler,
      );

      bootstrapStartupConfig(data.payload);
      window.initData = data.payload;

      if (!hasRenderedApplication) {
        void renderApplication(data.payload);
        return;
      }

      sendNativeLifecycleMessage("appReady");
    } catch {
      // Ignore malformed startup messages.
    }
  };

  window.addEventListener("HybridWebViewMessageReceived", initDataHandler);
  renderWithNativeFallback();
  hydrateNativeStartupConfig();
  sendNativeLifecycleMessage("appInit");
}
