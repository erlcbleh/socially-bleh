import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "../../lib/queryStore";
import { LuX, LuStar } from "react-icons/lu";
import { api } from "../../lib/api";
import { useFavoriteGifs, useToggleFavoriteGif } from "../../hooks/useGifs";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import FlickerSpinner from "../shared/FlickerSpinner";

export interface GiphyResult {
  id: string;
  url: string;
  previewUrl: string;
  description: string;
}

export function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
  direction?: "down" | "up";
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"trending" | "favorites">("trending");
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300);
  const isDebouncing = !!trimmedQuery && debouncedQuery !== trimmedQuery;
  const activeQuery = trimmedQuery ? debouncedQuery : "";
  const { data: favoritesData } = useFavoriteGifs();
  const toggleFavorite = useToggleFavoriteGif();
  const favoriteIds = new Set((favoritesData?.results ?? []).map((g) => g.id));

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["gifs", activeQuery],
    queryFn: () => api.get<{ results: GiphyResult[] }>(`/gifs/search?q=${encodeURIComponent(activeQuery)}`),
    enabled: (!trimmedQuery && tab === "trending") || (!!trimmedQuery && !isDebouncing),
  });

  const results = trimmedQuery ? (isDebouncing ? undefined : data?.results) : tab === "trending" ? data?.results : favoritesData?.results;
  const showingFavorites = !trimmedQuery && tab === "favorites";
  const showingLoader = isDebouncing || isLoading;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto overscroll-contain p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIPHY"
            className="w-full min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-800"
          />
          <button onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
            <LuX className="h-4 w-4" />
          </button>
        </div>

        {!trimmedQuery && (
          <div className="mb-2 flex gap-1">
            <button
              onClick={() => setTab("trending")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === "trending" ? "bg-brand text-white" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Trending
            </button>
            <button
              onClick={() => setTab("favorites")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab === "favorites" ? "bg-brand text-white" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Favorites
            </button>
          </div>
        )}

        <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto">
          {showingLoader && !showingFavorites && <div className="col-span-2 flex justify-center py-6"><FlickerSpinner /></div>}
          {!showingLoader && !!error && !showingFavorites && (
            <div className="col-span-2 py-6 text-center">
              <p className="text-sm text-neutral-400">Failed to load GIFs</p>
              <button onClick={() => refetch()} className="mt-2 text-sm font-medium text-brand hover:underline">Try again</button>
            </div>
          )}
          {!showingLoader && !error && results?.length === 0 && (
            <p className="col-span-2 py-6 text-center text-sm text-neutral-400">
              {showingFavorites ? "No favorite GIFs yet" : "No GIFs found"}
            </p>
          )}
          {results?.map((gif) => {
            const isFavorited = favoriteIds.has(gif.id);
            return (
              <div key={gif.id} className="group relative overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800">
                <button onClick={() => onSelect(gif.url)} className="block h-28 w-full hover:opacity-80">
                  <img src={gif.previewUrl} alt={gif.description} className="h-28 w-full object-cover" />
                </button>
                <button
                  onClick={() => toggleFavorite.mutate({ gif, isFavorited })}
                  disabled={toggleFavorite.isPending}
                  aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                  className={`absolute right-1 top-1 rounded-full bg-black/50 p-1 opacity-0 group-hover:opacity-100 disabled:opacity-100 ${
                    isFavorited ? "opacity-100" : ""
                  }`}
                >
                  <LuStar className={`h-3.5 w-3.5 ${isFavorited ? "fill-amber-400 text-amber-400" : "text-white"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
