import { create } from "zustand";
import type { GatewayPrincipal } from "../../../lib/gatewayAuthClient";
import {
  persistGatewayAuthSession,
  type PersistedGatewayAuthSession,
} from "../authSessionStorage";

type AuthMode = "login" | "register";

type AuthStore = {
  authSession: PersistedGatewayAuthSession | null;
  accessToken: string | null;
  currentPrincipal: GatewayPrincipal | null;
  isAuthBootstrapping: boolean;
  authMode: AuthMode;
  authUsername: string;
  authPassword: string;
  authDisplayName: string;
  authEmail: string;
  authError: string | null;
  isAuthenticating: boolean;
  setAccessToken: (accessToken: string | null) => void;
  setAuthSession: (authSession: PersistedGatewayAuthSession | null) => void;
  setCurrentPrincipal: (principal: GatewayPrincipal | null) => void;
  setIsAuthBootstrapping: (isAuthBootstrapping: boolean) => void;
  setAuthMode: (authMode: AuthMode) => void;
  setAuthUsername: (authUsername: string) => void;
  setAuthPassword: (authPassword: string) => void;
  setAuthDisplayName: (authDisplayName: string) => void;
  setAuthEmail: (authEmail: string) => void;
  setAuthError: (authError: string | null) => void;
  setIsAuthenticating: (isAuthenticating: boolean) => void;
  applyAuthentication: (
    authSession: PersistedGatewayAuthSession,
    principal: GatewayPrincipal,
  ) => void;
  clearAuthentication: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  authSession: null,
  accessToken: null,
  currentPrincipal: null,
  isAuthBootstrapping: true,
  authMode: "login",
  authUsername: "",
  authPassword: "",
  authDisplayName: "",
  authEmail: "",
  authError: null,
  isAuthenticating: false,
  setAccessToken: (accessToken) => {
    set((state) => {
      const nextAuthSession = state.authSession
        ? {
            ...state.authSession,
            accessToken: accessToken ?? "",
          }
        : null;

      persistGatewayAuthSession(nextAuthSession);
      return {
        accessToken,
        authSession: nextAuthSession,
      };
    });
  },
  setAuthSession: (authSession) => {
    persistGatewayAuthSession(authSession);
    set({
      authSession,
      accessToken: authSession?.accessToken ?? null,
    });
  },
  setCurrentPrincipal: (currentPrincipal) => set({ currentPrincipal }),
  setIsAuthBootstrapping: (isAuthBootstrapping) => set({ isAuthBootstrapping }),
  setAuthMode: (authMode) => set({ authMode }),
  setAuthUsername: (authUsername) => set({ authUsername }),
  setAuthPassword: (authPassword) => set({ authPassword }),
  setAuthDisplayName: (authDisplayName) => set({ authDisplayName }),
  setAuthEmail: (authEmail) => set({ authEmail }),
  setAuthError: (authError) => set({ authError }),
  setIsAuthenticating: (isAuthenticating) => set({ isAuthenticating }),
  applyAuthentication: (authSession, currentPrincipal) => {
    persistGatewayAuthSession(authSession);
    set({
      authSession,
      accessToken: authSession.accessToken,
      currentPrincipal,
      authError: null,
    });
  },
  clearAuthentication: () => {
    persistGatewayAuthSession(null);
    set({
      authSession: null,
      accessToken: null,
      currentPrincipal: null,
      authError: null,
      isAuthenticating: false,
    });
  },
}));

export const selectIsAppLoggedIn = (state: AuthStore) =>
  Boolean(state.accessToken && state.currentPrincipal);
