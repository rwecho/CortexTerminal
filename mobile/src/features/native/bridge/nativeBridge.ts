export type NativePickedFile = {
  fileName: string;
  contentType: string;
  size: number;
  base64: string;
};

export type NativeRecordedAudio = NativePickedFile & {
  durationMs?: number;
};

type NativeAlertOptions = {
  title: string;
  message: string;
  accept?: string;
  cancel?: string;
};

type NativeBridgeResponse<T> = T & {
  error?: string;
};

type BrowserRecorderState = {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  chunks: BlobPart[];
  startedAt: number;
};

type HybridWebViewApi = {
  InvokeDotNet?: (methodName: string, ...args: unknown[]) => Promise<string>;
};

declare global {
  interface Window {
    HybridWebView?: HybridWebViewApi;
  }
}

let browserRecorderState: BrowserRecorderState | null = null;

function hasNativeBridge(): boolean {
  return typeof window.HybridWebView?.InvokeDotNet === "function";
}

async function invokeNative<T>(
  methodName: string,
  ...args: unknown[]
): Promise<NativeBridgeResponse<T>> {
  const invokeDotNet = window.HybridWebView?.InvokeDotNet;

  if (!invokeDotNet) {
    throw new Error("HybridWebView native bridge is not available.");
  }

  const rawResponse = await invokeDotNet(methodName, ...args);
  const response = JSON.parse(rawResponse) as NativeBridgeResponse<T>;

  if (response.error) {
    throw new Error(response.error);
  }

  return response;
}

function createFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.display = "none";
  document.body.appendChild(input);
  return input;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("File read failed"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file reader payload."));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

async function pickBrowserFiles(): Promise<NativePickedFile[]> {
  const input = createFileInput();

  try {
    const files = await new Promise<FileList | null>((resolve) => {
      input.addEventListener(
        "change",
        () => {
          resolve(input.files);
        },
        { once: true },
      );

      input.click();
    });

    if (!files || files.length === 0) {
      return [];
    }

    return Promise.all(
      Array.from(files).map(async (file) => ({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        base64: await readFileAsBase64(file),
      })),
    );
  } finally {
    input.remove();
  }
}

async function startBrowserRecording(): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    throw new Error(
      "当前浏览器不支持录音。请使用 MAUI shell 或支持 MediaRecorder 的浏览器。",
    );
  }

  if (browserRecorderState) {
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : undefined;
  const mediaRecorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: BlobPart[] = [];

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  mediaRecorder.start();
  browserRecorderState = {
    mediaRecorder,
    stream,
    chunks,
    startedAt: Date.now(),
  };
}

async function stopBrowserRecording(): Promise<NativeRecordedAudio | null> {
  if (!browserRecorderState) {
    return null;
  }

  const { mediaRecorder, stream, chunks, startedAt } = browserRecorderState;
  browserRecorderState = null;

  const blob = await new Promise<Blob>((resolve) => {
    mediaRecorder.addEventListener(
      "stop",
      () => {
        resolve(
          new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" }),
        );
      },
      { once: true },
    );
    mediaRecorder.stop();
  });

  stream.getTracks().forEach((track) => track.stop());

  if (blob.size === 0) {
    return null;
  }

  const file = new File([blob], `recording-${Date.now()}.webm`, {
    type: blob.type || "audio/webm",
  });

  return {
    fileName: file.name,
    contentType: file.type || "audio/webm",
    size: file.size,
    base64: await readFileAsBase64(file),
    durationMs: Date.now() - startedAt,
  };
}

export function getNativeBridgeSource(): "native" | "browser" {
  return hasNativeBridge() ? "native" : "browser";
}

export async function showNativeToast(message: string): Promise<void> {
  if (hasNativeBridge()) {
    await invokeNative<{ success: boolean }>("ShowToastAsync", message);
    return;
  }

  console.info(`[toast] ${message}`);
}

export async function showNativeAlert({
  title,
  message,
  accept = "确定",
  cancel,
}: NativeAlertOptions): Promise<boolean> {
  if (hasNativeBridge()) {
    const response = await invokeNative<{ confirmed: boolean }>(
      "ShowAlertAsync",
      title,
      message,
      accept,
      cancel ?? "",
    );
    return Boolean(response.confirmed);
  }

  if (cancel) {
    return window.confirm(`${title}\n\n${message}`);
  }

  window.alert(`${title}\n\n${message}`);
  return true;
}

export async function pickNativeFiles(): Promise<NativePickedFile[]> {
  if (hasNativeBridge()) {
    const response = await invokeNative<{
      cancelled?: boolean;
      files?: NativePickedFile[];
    }>("PickFilesAsync");
    return response.cancelled ? [] : (response.files ?? []);
  }

  return pickBrowserFiles();
}

export async function startNativeRecording(): Promise<void> {
  if (hasNativeBridge()) {
    await invokeNative<{ success: boolean }>("StartAudioRecordingAsync");
    return;
  }

  await startBrowserRecording();
}

export async function stopNativeRecording(): Promise<NativeRecordedAudio | null> {
  if (hasNativeBridge()) {
    const response = await invokeNative<
      NativeRecordedAudio & { cancelled?: boolean }
    >("StopAudioRecordingAsync");
    return response.cancelled ? null : response;
  }

  return stopBrowserRecording();
}
