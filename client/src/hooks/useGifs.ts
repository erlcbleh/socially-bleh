import { useMutation, useQuery, useQueryClient } from "../lib/queryStore";
import { api } from "../lib/api";
import type { GiphyResult } from "../components/post/GifPicker";

export function useFavoriteGifs() {
  return useQuery({
    queryKey: ["gifs", "favorites"],
    queryFn: () => api.get<{ results: GiphyResult[] }>("/gifs/favorites"),
  });
}

export function useToggleFavoriteGif() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gif, isFavorited }: { gif: GiphyResult; isFavorited: boolean }) =>
      isFavorited ? api.delete(`/gifs/favorites/${encodeURIComponent(gif.id)}`) : api.post("/gifs/favorites", gif),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gifs", "favorites"] }),
  });
}
