import { AuditPage } from "../AuditPage";
import { useAuditEntriesLoader } from "../hooks/useAuditEntries";
import { useAuditStore } from "../store/useAuditStore";

export function AuditRoute() {
  useAuditEntriesLoader();
  const entries = useAuditStore((state) => state.entries);
  const isLoading = useAuditStore((state) => state.isLoading);
  const error = useAuditStore((state) => state.error);

  return <AuditPage entries={entries} isLoading={isLoading} error={error} />;
}
