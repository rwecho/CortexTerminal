import { useCallback } from "react";
import { isAuthFailure } from "../appUtils";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useResetApplicationState } from "./useResetApplicationState";

const sessionExpiredMessage =
  "登录已过期，请重新登录。\nYour session expired. Please sign in again.";

export function useAuthFailureHandler() {
  const resetApplicationState = useResetApplicationState();
  const setAuthError = useAuthStore((state) => state.setAuthError);

  return useCallback(
    (message: string) => {
      if (!isAuthFailure(message)) {
        return false;
      }

      resetApplicationState();
      setAuthError(sessionExpiredMessage);
      return true;
    },
    [resetApplicationState, setAuthError],
  );
}
