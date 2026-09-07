import { create } from "zustand";
import type { AppUser } from "@/lib/types";

type AuthStatus = "idle" | "loading" | "ready" | "error";

type AuthStore = {
  status: AuthStatus;
  isBootstrapped: boolean;
  user: AppUser | null;
  accessToken: string | null;
  error: string | null;

  setLoading: () => void;
  setUser: (user: AppUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setError: (message: string) => void;
  clearAuth: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  status: "idle",
  isBootstrapped: false,
  user: null,
  accessToken: null,
  error: null,
  setLoading: () =>
    set({
      status: "loading",
      error: null,
    }),
  setUser: (user) =>
    set({
      status: "ready",
      isBootstrapped: true,
      user,
      error: null,
    }),
  setAccessToken: (token) =>
    set({
      accessToken: token,
    }),
  setError: (message) =>
    set({
      status: "error",
      isBootstrapped: true,
      error: message,
    }),
  clearAuth: () =>
    set({
      status: "ready",
      isBootstrapped: true,
      user: null,
      accessToken: null,
      error: null,
    }),
  logout: () =>
    set({
      status: "ready",
      isBootstrapped: true,
      user: null,
      accessToken: null,
      error: null,
    }),
}));
