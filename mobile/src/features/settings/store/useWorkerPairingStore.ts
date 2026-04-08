import { create } from "zustand";

type WorkerPairingStore = {
  workerRegistrationKey: string | null;
  workerRegistrationKeyIssuedAtUtc: string | null;
  workerRegistrationKeyError: string | null;
  isIssuingWorkerRegistrationKey: boolean;
  setWorkerRegistrationKey: (workerRegistrationKey: string | null) => void;
  setWorkerRegistrationKeyIssuedAtUtc: (issuedAtUtc: string | null) => void;
  setWorkerRegistrationKeyError: (
    workerRegistrationKeyError: string | null,
  ) => void;
  setIsIssuingWorkerRegistrationKey: (
    isIssuingWorkerRegistrationKey: boolean,
  ) => void;
  resetWorkerPairingState: () => void;
};

export const useWorkerPairingStore = create<WorkerPairingStore>((set) => ({
  workerRegistrationKey: null,
  workerRegistrationKeyIssuedAtUtc: null,
  workerRegistrationKeyError: null,
  isIssuingWorkerRegistrationKey: false,
  setWorkerRegistrationKey: (workerRegistrationKey) =>
    set({ workerRegistrationKey }),
  setWorkerRegistrationKeyIssuedAtUtc: (workerRegistrationKeyIssuedAtUtc) =>
    set({ workerRegistrationKeyIssuedAtUtc }),
  setWorkerRegistrationKeyError: (workerRegistrationKeyError) =>
    set({ workerRegistrationKeyError }),
  setIsIssuingWorkerRegistrationKey: (isIssuingWorkerRegistrationKey) =>
    set({ isIssuingWorkerRegistrationKey }),
  resetWorkerPairingState: () =>
    set({
      workerRegistrationKey: null,
      workerRegistrationKeyIssuedAtUtc: null,
      workerRegistrationKeyError: null,
      isIssuingWorkerRegistrationKey: false,
    }),
}));
