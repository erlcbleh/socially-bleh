import { useQuery, useMutation } from "../lib/queryStore";
import { api } from "../lib/api";
import type { LinkedAccount, User } from "../types";

export function useLinkedAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ["linkedAccounts"],
    queryFn: () => api.get<{ accounts: LinkedAccount[] }>("/auth/accounts"),
    enabled,
  });
}

export function useSwitchAccount() {
  return useMutation({
    mutationFn: (userId: string) => api.post<{ user: User }>(`/auth/accounts/${userId}/switch`),
  });
}

export function useSwitchToPersonal() {
  return useMutation<{ user: User }, void>({
    mutationFn: () => api.post<{ user: User }>("/auth/switch-to-personal"),
  });
}
