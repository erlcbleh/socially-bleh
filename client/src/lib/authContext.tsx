import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "./queryStore";
import { api, ApiError, setAccountBlockedHandler } from "./api";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get<{ user: User | null }>("/auth/me").catch((err) => {
        if (err instanceof ApiError && err.status === 401) return { user: null };
        throw err;
      }),
  });

  useEffect(() => {
    setAccountBlockedHandler(() => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      refetch();
    });
    return () => setAccountBlockedHandler(null);
  }, [queryClient, refetch]);

  const value: AuthContextValue = {
    user: data?.user ?? null,
    isLoading,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      refetch();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
