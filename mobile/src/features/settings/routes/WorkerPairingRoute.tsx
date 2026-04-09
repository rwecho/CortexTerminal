import { useNavigate } from "react-router-dom";
import { WorkerPairingPage } from "../WorkerPairingPage";
import { useWorkerPairingActions } from "../hooks/useWorkerPairingActions";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";
import { buildAppPath } from "../../app/routeUtils";

export function WorkerPairingRoute() {
  const navigate = useNavigate();
  const workerInstallCommand = useWorkerPairingStore(
    (state) => state.workerInstallCommand,
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
      workerInstallCommand={workerInstallCommand}
      workerInstallError={workerInstallError}
      isIssuingWorkerInstallToken={isIssuingWorkerInstallToken}
      onBack={() => navigate(buildAppPath("settings"))}
      onIssueWorkerInstallToken={handleIssueWorkerInstallToken}
    />
  );
}
