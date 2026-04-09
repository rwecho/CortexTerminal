import { create } from "zustand";
import type { WorkerInstallCommandSet } from "../../../lib/gatewayAuthClient";

type WorkerPairingStore = {
  workerInstallCommands: WorkerInstallCommandSet | null;
  workerInstallError: string | null;
  isIssuingWorkerInstallToken: boolean;
  setWorkerInstallCommands: (
    workerInstallCommands: WorkerInstallCommandSet | null,
  ) => void;
  setWorkerInstallError: (workerInstallError: string | null) => void;
  setIsIssuingWorkerInstallToken: (
    isIssuingWorkerInstallToken: boolean,
  ) => void;
  resetWorkerPairingState: () => void;
};

export const useWorkerPairingStore = create<WorkerPairingStore>((set) => ({
  workerInstallCommands: null,
  workerInstallError: null,
  isIssuingWorkerInstallToken: false,
  setWorkerInstallCommands: (workerInstallCommands) =>
    set({ workerInstallCommands }),
  setWorkerInstallError: (workerInstallError) => set({ workerInstallError }),
  setIsIssuingWorkerInstallToken: (isIssuingWorkerInstallToken) =>
    set({ isIssuingWorkerInstallToken }),
  resetWorkerPairingState: () =>
    set({
      workerInstallCommands: null,
      workerInstallError: null,
      isIssuingWorkerInstallToken: false,
    }),
}));
