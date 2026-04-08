import { useNavigate } from "react-router-dom";
import { WorkerPairingPage } from "../WorkerPairingPage";
import { useWorkerPairingActions } from "../hooks/useWorkerPairingActions";
import { useWorkerPairingStore } from "../store/useWorkerPairingStore";
import { buildAppPath } from "../../app/routeUtils";

export function WorkerPairingRoute() {
  const navigate = useNavigate();
  const workerRegistrationKey = useWorkerPairingStore(
    (state) => state.workerRegistrationKey,
  );
  const workerRegistrationKeyIssuedAtUtc = useWorkerPairingStore(
    (state) => state.workerRegistrationKeyIssuedAtUtc,
  );
  const workerRegistrationKeyError = useWorkerPairingStore(
    (state) => state.workerRegistrationKeyError,
  );
  const isIssuingWorkerRegistrationKey = useWorkerPairingStore(
    (state) => state.isIssuingWorkerRegistrationKey,
  );
  const { handleIssueWorkerRegistrationKey } = useWorkerPairingActions();

  return (
    <WorkerPairingPage
      workerRegistrationKey={workerRegistrationKey}
      workerRegistrationKeyIssuedAtUtc={workerRegistrationKeyIssuedAtUtc}
      workerRegistrationKeyError={workerRegistrationKeyError}
      isIssuingWorkerRegistrationKey={isIssuingWorkerRegistrationKey}
      onBack={() => navigate(buildAppPath("settings"))}
      onIssueWorkerRegistrationKey={handleIssueWorkerRegistrationKey}
    />
  );
}
