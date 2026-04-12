import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isNativeStartupRuntime } from "../startup/nativeStartup";

declare global {
  interface Window {
    __cortexHandleNativeBack?: () => boolean;
  }
}

function sendNativeNavigationState(canGoBack: boolean, pathname: string) {
  try {
    window.HybridWebView?.SendRawMessage?.(
      JSON.stringify({
        type: "navigationState",
        payload: {
          canGoBack,
          pathname,
        },
      }),
    );
  } catch {
    // Ignore native bridge dispatch failures.
  }
}

export function NativeNavigationSync() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeStartupRuntime()) {
      return;
    }

    const canGoBack = location.pathname !== "/";

    window.__cortexHandleNativeBack = () => {
      if (!canGoBack) {
        return false;
      }

      navigate(-1);
      return true;
    };

    sendNativeNavigationState(canGoBack, location.pathname);

    return () => {
      delete window.__cortexHandleNativeBack;
    };
  }, [location.pathname, navigate]);

  return null;
}
