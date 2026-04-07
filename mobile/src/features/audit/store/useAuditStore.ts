import { create } from "zustand";
import type { GatewayAuditEntry } from "../../../lib/gatewayManagementClient";

type AuditStore = {
  entries: GatewayAuditEntry[];
  isLoading: boolean;
  error: string | null;
  setEntries: (entries: GatewayAuditEntry[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  resetAuditState: () => void;
};

export const useAuditStore = create<AuditStore>((set) => ({
  entries: [],
  isLoading: false,
  error: null,
  setEntries: (entries) => set({ entries }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  resetAuditState: () => set({ entries: [], isLoading: false, error: null }),
}));
