import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthenticatedHandler } from "./api";
import type { StaffContext, StaffSessionResponse, StaffUser } from "../types";

interface AuthState {
  user: StaffUser | null;
  staff: StaffContext | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContextValue = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [staff, setStaff] = useState<StaffContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<StaffSessionResponse>("/auth/me");
      setUser(data.user);
      setStaff(data.staff);
    } catch {
      setUser(null);
      setStaff(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
      setStaff(null);
    }
  }, []);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      setStaff(null);
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, staff, isLoading, logout, refresh }),
    [user, staff, isLoading, logout, refresh]
  );

  return <AuthContextValue.Provider value={value}>{children}</AuthContextValue.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContextValue);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
