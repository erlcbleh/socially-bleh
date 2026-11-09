import { useQuery } from "../lib/queryStore";
import { api } from "../lib/api";
import { useNavCommunitySlug } from "./useCommunitySlug";
import type { TrendingTag } from "../types";

export function useTrending() {
  const slug = useNavCommunitySlug();
  return useQuery({
    queryKey: ["trending", "hashtags", slug],
    queryFn: () => api.get<{ tags: TrendingTag[] }>(`/communities/${slug}/trending/hashtags`),
    enabled: !!slug,
  });
}
