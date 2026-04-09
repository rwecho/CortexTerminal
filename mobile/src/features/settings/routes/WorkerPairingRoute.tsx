import { useNavigate } from "react-router-dom";
import { WorkerPairingPage } from "../WorkerPairingPage";
import { useWorkerPairingActions } from "../hooks/useWorkerPairingActions";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";
import { buildAppPath } from "../../app/routeUtils";
import { getStartupConfig } from "../../native/startup/nativeStartup";

export function WorkerPairingRoute() {
  const navigate = useNavigate();
  const workerInstallCommands = useWorkerPairingStore(
    (state) => state.workerInstallCommands,
  );
  const workerInstallError = useWorkerPairingStore(
    (state) => state.workerInstallError,
  );
  const isIssuingWorkerInstallToken = useWorkerPairingStore(
    (state) => state.isIssuingWorkerInstallToken,
  );
  const { handleIssueWorkerInstallToken } = useWorkerPairingActions();
  const defaultInstallPlatform =
    getStartupConfig().platform === "windows" ? "windows" : "unix";

  return (
    <WorkerPairingPage
      workerInstallCommands={workerInstallCommands}
      workerInstallError={workerInstallError}
      isIssuingWorkerInstallToken={isIssuingWorkerInstallToken}
      defaultInstallPlatform={defaultInstallPlatform}
      onBack={() => navigate(buildAppPath("settings"))}
      onIssueWorkerInstallToken={handleIssueWorkerInstallToken}
    />
  );
}
