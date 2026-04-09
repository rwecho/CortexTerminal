import { create } from "zustand";

type WorkerPairingStore = {
  workerInstallCommand: string | null;
  workerInstallError: string | null;
  isIssuingWorkerInstallToken: boolean;
  setWorkerInstallCommand: (workerInstallCommand: string | null) => void;
  setWorkerInstallError: (workerInstallError: string | null) => void;
  setIsIssuingWorkerInstallToken: (
    isIssuingWorkerInstallToken: boolean,
  ) => void;
  resetWorkerPairingState: () => void;
};

export const useWorkerPairingStore = create<WorkerPairingStore>((set) => ({
  workerInstallCommand: null,
  workerInstallError: null,
  isIssuingWorkerInstallToken: false,
  setWorkerInstallCommand: (workerInstallCommand) =>
    set({ workerInstallCommand }),
  setWorkerInstallError: (workerInstallError) => set({ workerInstallError }),
  setIsIssuingWorkerInstallToken: (isIssuingWorkerInstallToken) =>
    set({ isIssuingWorkerInstallToken }),
  resetWorkerPairingState: () =>
    set({
      workerInstallCommand: null,
      workerInstallError: null,
      isIssuingWorkerInstallToken: false,
    }),
}));
