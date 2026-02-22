import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { AuthUser, LoginInput, RegisterInput } from "@/types/auth";
import { AuthContext } from "./auth-context-instance";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiRequest<{ user: AuthUser }>("/auth/me", {
        method: "GET",
      });
      setUser(response.user);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const response = await apiRequest<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });

    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const response = await apiRequest<{ user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });

    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>("/auth/logout", {
        method: "POST",
      });
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, refreshSession }),
    [user, status, login, register, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export type { AuthContextValue };
