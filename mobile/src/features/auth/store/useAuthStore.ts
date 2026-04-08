import { create } from "zustand";
import type { GatewayPrincipal } from "../../../lib/gatewayAuthClient";
import { gatewayTokenStorageKey } from "../../app/config";

type AuthMode = "login" | "register";

type AuthStore = {
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
    accessToken: string,
    principal: GatewayPrincipal,
  ) => void;
  clearAuthentication: () => void;
};

function persistAccessToken(accessToken: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (accessToken) {
    window.localStorage.setItem(gatewayTokenStorageKey, accessToken);
    return;
  }

  window.localStorage.removeItem(gatewayTokenStorageKey);
}

export const useAuthStore = create<AuthStore>((set) => ({
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
    persistAccessToken(accessToken);
    set({ accessToken });
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
  applyAuthentication: (accessToken, currentPrincipal) => {
    persistAccessToken(accessToken);
    set({
      accessToken,
      currentPrincipal,
      authError: null,
    });
  },
  clearAuthentication: () => {
    persistAccessToken(null);
    set({
      accessToken: null,
      currentPrincipal: null,
      authError: null,
      isAuthenticating: false,
    });
  },
}));

export const selectIsAppLoggedIn = (state: AuthStore) =>
  Boolean(state.accessToken && state.currentPrincipal);
