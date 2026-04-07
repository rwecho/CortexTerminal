import { useNavigate } from "react-router-dom";
import { WorkerPairingPage } from "../WorkerPairingPage";
import { useWorkerPairingActions } from "../hooks/useWorkerPairingActions";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";
import { buildAppPath } from "../../app/routeUtils";

export function WorkerPairingRoute() {
  const navigate = useNavigate();
  const workerPairingCode = useWorkerPairingStore(
    (state) => state.workerPairingCode,
  );
  const workerPairingError = useWorkerPairingStore(
    (state) => state.workerPairingError,
  );
  const workerPairingMessage = useWorkerPairingStore(
    (state) => state.workerPairingMessage,
  );
  const isApprovingWorkerPairing = useWorkerPairingStore(
    (state) => state.isApprovingWorkerPairing,
  );
  const setWorkerPairingCode = useWorkerPairingStore(
    (state) => state.setWorkerPairingCode,
  );
  const { handleApproveWorkerPairing } = useWorkerPairingActions();

  return (
    <WorkerPairingPage
      workerPairingCode={workerPairingCode}
      workerPairingError={workerPairingError}
      workerPairingMessage={workerPairingMessage}
      isApprovingWorkerPairing={isApprovingWorkerPairing}
      onBack={() => navigate(buildAppPath("settings"))}
      onWorkerPairingCodeChange={setWorkerPairingCode}
      onApprove={handleApproveWorkerPairing}
    />
  );
}
