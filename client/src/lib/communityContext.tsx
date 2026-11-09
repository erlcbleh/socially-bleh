import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "./queryStore";
import { useNavCommunitySlug } from "../hooks/useCommunitySlug";
import { api } from "./api";
import type { Community } from "../types";

interface CommunityContextValue {
  community: Community | null;
  isLoading: boolean;
  error: Error | null;
  isOwner: boolean;
  isStaff: boolean;
  canManageCommunity: boolean;
  refetch: () => void;
}

const CommunityContext = createContext<CommunityContextValue | undefined>(undefined);

export function CommunityProvider({ children }: { children: ReactNode }) {
  const communitySlug = useNavCommunitySlug();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["community", communitySlug],
    queryFn: () => api.get<{ community: Community }>(`/communities/${communitySlug}`),
    enabled: !!communitySlug,
  });

  const community = data?.community ?? null;

  const value: CommunityContextValue = {
    community,
    isLoading,
    error,
    isOwner: community?.myRole === "owner",
    isStaff: community?.myRole === "owner" || community?.myRole === "staff",
    canManageCommunity:
      !community?.isGlobal && (community?.myRole === "owner" || community?.myRole === "staff"),
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["community", communitySlug] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      refetch();
    },
  };

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error("useCommunity must be used within CommunityProvider");
  return ctx;
}
