import { useNavigate } from "react-router-dom";
import { SettingsPage } from "../SettingsPage";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useAuthActions } from "../../auth/hooks/useAuthActions";
import { buildAppPath } from "../../app/routeUtils";

export function SettingsRoute() {
  const navigate = useNavigate();
  const currentPrincipal = useAuthStore((state) => state.currentPrincipal);
  const { handleSignOut } = useAuthActions();

  return (
    <SettingsPage
      currentPrincipal={currentPrincipal}
      onOpenPairWorker={() => navigate(buildAppPath("pairWorker"))}
      onOpenAudit={() => navigate(buildAppPath("audit"))}
      onSignOut={handleSignOut}
    />
  );
}
