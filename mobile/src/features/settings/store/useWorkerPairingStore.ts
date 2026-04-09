import { create } from "zustand";

type WorkerPairingStore = {
  workerInstallToken: string | null;
  workerInstallCommand: string | null;
  workerInstallUrl: string | null;
  workerInstallIssuedAtUtc: string | null;
  workerInstallExpiresAtUtc: string | null;
  workerInstallError: string | null;
  isIssuingWorkerInstallToken: boolean;
  setWorkerInstallToken: (workerInstallToken: string | null) => void;
  setWorkerInstallCommand: (workerInstallCommand: string | null) => void;
  setWorkerInstallUrl: (workerInstallUrl: string | null) => void;
  setWorkerInstallIssuedAtUtc: (issuedAtUtc: string | null) => void;
  setWorkerInstallExpiresAtUtc: (expiresAtUtc: string | null) => void;
  setWorkerInstallError: (workerInstallError: string | null) => void;
  setIsIssuingWorkerInstallToken: (
    isIssuingWorkerInstallToken: boolean,
  ) => void;
  resetWorkerPairingState: () => void;
};

export const useWorkerPairingStore = create<WorkerPairingStore>((set) => ({
  workerInstallToken: null,
  workerInstallCommand: null,
  workerInstallUrl: null,
  workerInstallIssuedAtUtc: null,
  workerInstallExpiresAtUtc: null,
  workerInstallError: null,
  isIssuingWorkerInstallToken: false,
  setWorkerInstallToken: (workerInstallToken) => set({ workerInstallToken }),
  setWorkerInstallCommand: (workerInstallCommand) =>
    set({ workerInstallCommand }),
  setWorkerInstallUrl: (workerInstallUrl) => set({ workerInstallUrl }),
  setWorkerInstallIssuedAtUtc: (workerInstallIssuedAtUtc) =>
    set({ workerInstallIssuedAtUtc }),
  setWorkerInstallExpiresAtUtc: (workerInstallExpiresAtUtc) =>
    set({ workerInstallExpiresAtUtc }),
  setWorkerInstallError: (workerInstallError) => set({ workerInstallError }),
  setIsIssuingWorkerInstallToken: (isIssuingWorkerInstallToken) =>
    set({ isIssuingWorkerInstallToken }),
  resetWorkerPairingState: () =>
    set({
      workerInstallToken: null,
      workerInstallCommand: null,
      workerInstallUrl: null,
      workerInstallIssuedAtUtc: null,
      workerInstallExpiresAtUtc: null,
      workerInstallError: null,
      isIssuingWorkerInstallToken: false,
    }),
}));
