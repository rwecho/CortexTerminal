import { create } from "zustand";

type WorkerPairingStore = {
  workerPairingCode: string;
  workerPairingError: string | null;
  workerPairingMessage: string | null;
  isApprovingWorkerPairing: boolean;
  setWorkerPairingCode: (workerPairingCode: string) => void;
  setWorkerPairingError: (workerPairingError: string | null) => void;
  setWorkerPairingMessage: (workerPairingMessage: string | null) => void;
  setIsApprovingWorkerPairing: (isApprovingWorkerPairing: boolean) => void;
  resetWorkerPairingState: () => void;
};

export const useWorkerPairingStore = create<WorkerPairingStore>((set) => ({
  workerPairingCode: "",
  workerPairingError: null,
  workerPairingMessage: null,
  isApprovingWorkerPairing: false,
  setWorkerPairingCode: (workerPairingCode) => set({ workerPairingCode }),
  setWorkerPairingError: (workerPairingError) => set({ workerPairingError }),
  setWorkerPairingMessage: (workerPairingMessage) =>
    set({ workerPairingMessage }),
  setIsApprovingWorkerPairing: (isApprovingWorkerPairing) =>
    set({ isApprovingWorkerPairing }),
  resetWorkerPairingState: () =>
    set({
      workerPairingCode: "",
      workerPairingError: null,
      workerPairingMessage: null,
      isApprovingWorkerPairing: false,
    }),
}));
