"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthUser = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  roles: string[];
  permissions: string[];
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: ({ accessToken, refreshToken, user }) =>
        set({
          accessToken,
          refreshToken,
          user
        }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null })
    }),
    {
      name: "web-betong-auth",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
