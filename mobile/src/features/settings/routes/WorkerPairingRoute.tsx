import { useNavigate } from "react-router-dom";
import { WorkerPairingPage } from "../WorkerPairingPage";
import { useWorkerPairingActions } from "../hooks/useWorkerPairingActions";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";
import { buildAppPath } from "../../app/routeUtils";

export function WorkerPairingRoute() {
  const navigate = useNavigate();
  const workerInstallToken = useWorkerPairingStore(
    (state) => state.workerInstallToken,
  );
  const workerInstallCommand = useWorkerPairingStore(
    (state) => state.workerInstallCommand,
  );
  const workerInstallUrl = useWorkerPairingStore(
    (state) => state.workerInstallUrl,
  );
  const workerInstallIssuedAtUtc = useWorkerPairingStore(
    (state) => state.workerInstallIssuedAtUtc,
  );
  const workerInstallExpiresAtUtc = useWorkerPairingStore(
    (state) => state.workerInstallExpiresAtUtc,
  );
  const workerInstallError = useWorkerPairingStore(
    (state) => state.workerInstallError,
  );
  const isIssuingWorkerInstallToken = useWorkerPairingStore(
    (state) => state.isIssuingWorkerInstallToken,
  );
  const { handleIssueWorkerInstallToken } = useWorkerPairingActions();

  return (
    <WorkerPairingPage
      workerInstallToken={workerInstallToken}
      workerInstallCommand={workerInstallCommand}
      workerInstallUrl={workerInstallUrl}
      workerInstallIssuedAtUtc={workerInstallIssuedAtUtc}
      workerInstallExpiresAtUtc={workerInstallExpiresAtUtc}
      workerInstallError={workerInstallError}
      isIssuingWorkerInstallToken={isIssuingWorkerInstallToken}
      onBack={() => navigate(buildAppPath("settings"))}
      onIssueWorkerInstallToken={handleIssueWorkerInstallToken}
    />
  );
}
