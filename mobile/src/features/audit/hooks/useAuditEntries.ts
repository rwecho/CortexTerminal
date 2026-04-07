import { useCallback, useEffect } from "react";
import {
  useAuthStore,
  selectIsAppLoggedIn,
} from "../../auth/store/useAuthStore";
import { useManagementClient } from "../../app/hooks/useManagementClient";
import { useAuthFailureHandler } from "../../app/hooks/useAuthFailureHandler";
import { useAuditStore } from "../store/useAuditStore";

export function useLoadAuditEntries() {
  const managementClient = useManagementClient();
  const handleAuthFailure = useAuthFailureHandler();
  const setEntries = useAuditStore((state) => state.setEntries);
  const setIsLoading = useAuditStore((state) => state.setIsLoading);
  const setError = useAuditStore((state) => state.setError);

  return useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextEntries = await managementClient.listAuditEntries(120);
      setEntries(nextEntries);
    } catch (error) {
      const message = (error as Error).message;
      if (!handleAuthFailure(message)) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthFailure, managementClient, setEntries, setError, setIsLoading]);
}

export function useAuditEntriesLoader() {
  const isAppLoggedIn = useAuthStore(selectIsAppLoggedIn);
  const loadAuditEntries = useLoadAuditEntries();

  useEffect(() => {
    if (!isAppLoggedIn) {
      return;
    }

    void loadAuditEntries();
  }, [isAppLoggedIn, loadAuditEntries]);

  return loadAuditEntries;
}
