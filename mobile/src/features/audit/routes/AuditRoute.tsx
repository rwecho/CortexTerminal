import { useNavigate } from "react-router-dom";
import { AuditPage } from "../AuditPage";
import { buildAppPath } from "../../app/routeUtils";
import { useAuditEntriesLoader } from "../hooks/useAuditEntries";
import { useAuditStore } from "../store/useAuditStore";

export function AuditRoute() {
  const navigate = useNavigate();
  useAuditEntriesLoader();
  const entries = useAuditStore((state) => state.entries);
  const isLoading = useAuditStore((state) => state.isLoading);
  const error = useAuditStore((state) => state.error);

  return (
    <AuditPage
      entries={entries}
      isLoading={isLoading}
      error={error}
      onBack={() => navigate(buildAppPath("settings"))}
    />
  );
}
