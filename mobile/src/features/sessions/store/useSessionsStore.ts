import { create } from "zustand";
import type {
  GatewaySession,
  GatewayWorker,
} from "../../../lib/gatewayManagementClient";
import type { AgentFamily } from "../../app/appTypes";

type SessionsStore = {
  workers: GatewayWorker[];
  sessions: GatewaySession[];
  hasLoadedManagementSnapshot: boolean;
  isLoadingManagement: boolean;
  managementError: string | null;
  isDeletingSessionId: string | null;
  isDeletingWorkerId: string | null;
  isQuickStartingWorkerId: string | null;
  newSessionAgentFamily: AgentFamily;
  newSessionWorkerId: string;
  newSessionPath: string;
  isCreatingSession: boolean;
  setWorkers: (workers: GatewayWorker[]) => void;
  setSessions: (sessions: GatewaySession[]) => void;
  setOverviewData: (
    workers: GatewayWorker[],
    sessions: GatewaySession[],
  ) => void;
  setHasLoadedManagementSnapshot: (
    hasLoadedManagementSnapshot: boolean,
  ) => void;
  setIsLoadingManagement: (isLoadingManagement: boolean) => void;
  setManagementError: (managementError: string | null) => void;
  setIsDeletingSessionId: (isDeletingSessionId: string | null) => void;
  setIsDeletingWorkerId: (isDeletingWorkerId: string | null) => void;
  setIsQuickStartingWorkerId: (isQuickStartingWorkerId: string | null) => void;
  setNewSessionAgentFamily: (newSessionAgentFamily: AgentFamily) => void;
  setNewSessionWorkerId: (newSessionWorkerId: string) => void;
  setNewSessionPath: (newSessionPath: string) => void;
  setIsCreatingSession: (isCreatingSession: boolean) => void;
  resetSessionsState: () => void;
};

export const useSessionsStore = create<SessionsStore>((set) => ({
  workers: [],
  sessions: [],
  hasLoadedManagementSnapshot: false,
  isLoadingManagement: false,
  managementError: null,
  isDeletingSessionId: null,
  isDeletingWorkerId: null,
  isQuickStartingWorkerId: null,
  newSessionAgentFamily: "claude",
  newSessionWorkerId: "",
  newSessionPath: "",
  isCreatingSession: false,
  setWorkers: (workers) => set({ workers }),
  setSessions: (sessions) => set({ sessions }),
  setOverviewData: (workers, sessions) =>
    set({
      workers,
      sessions,
      hasLoadedManagementSnapshot: true,
    }),
  setHasLoadedManagementSnapshot: (hasLoadedManagementSnapshot) =>
    set({ hasLoadedManagementSnapshot }),
  setIsLoadingManagement: (isLoadingManagement) => set({ isLoadingManagement }),
  setManagementError: (managementError) => set({ managementError }),
  setIsDeletingSessionId: (isDeletingSessionId) => set({ isDeletingSessionId }),
  setIsDeletingWorkerId: (isDeletingWorkerId) => set({ isDeletingWorkerId }),
  setIsQuickStartingWorkerId: (isQuickStartingWorkerId) =>
    set({ isQuickStartingWorkerId }),
  setNewSessionAgentFamily: (newSessionAgentFamily) =>
    set({ newSessionAgentFamily }),
  setNewSessionWorkerId: (newSessionWorkerId) => set({ newSessionWorkerId }),
  setNewSessionPath: (newSessionPath) => set({ newSessionPath }),
  setIsCreatingSession: (isCreatingSession) => set({ isCreatingSession }),
  resetSessionsState: () =>
    set({
      workers: [],
      sessions: [],
      hasLoadedManagementSnapshot: false,
      isLoadingManagement: false,
      managementError: null,
      isDeletingSessionId: null,
      isDeletingWorkerId: null,
      isQuickStartingWorkerId: null,
      newSessionAgentFamily: "claude",
      newSessionWorkerId: "",
      newSessionPath: "",
      isCreatingSession: false,
    }),
}));
