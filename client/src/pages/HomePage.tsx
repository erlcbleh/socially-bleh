import { useEffect, useRef, useState } from "react";
import { Composer } from "../components/post/Composer";
import { PostCard } from "../components/post/PostCard";
import { StoryTray } from "../components/story/StoryTray";
import { useFeed } from "../hooks/usePosts";
import { useAuth } from "../lib/authContext";
import FlickerSpinner from "../components/shared/FlickerSpinner";

export default function HomePage() {
  const { user } = useAuth();
  const isGuest = !user;
  const [mode, setMode] = useState<"forYou" | "following">("forYou");
  const { data, isLoading, hasMore, loadMore, isLoadingMore } = useFeed(mode);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div>
      <StoryTray />

      {!isGuest && (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur dark:bg-black/80">
          <div className="px-4">
            <div className="relative flex border-b border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setMode("forYou")}
                className={`flex-1 py-3 text-center font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 ${
                  mode === "forYou" ? "text-black dark:text-white" : "text-neutral-500"
                }`}
              >
                For you
              </button>
              <button
                onClick={() => setMode("following")}
                className={`flex-1 py-3 text-center font-medium transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900 ${
                  mode === "following" ? "text-black dark:text-white" : "text-neutral-500"
                }`}
              >
                Following
              </button>
              <div
                className="absolute -bottom-px left-0 h-0.5 w-1/2 bg-brand transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${mode === "forYou" ? "0%" : "100%"})` }}
              />
            </div>
          </div>
        </div>
      )}

      {!isGuest && <Composer />}

      <div key={mode} className="mt-4 motion-safe:animate-fade-in">
        {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
        {!isLoading && data?.posts.length === 0 && (
          <p className="p-6 text-center text-neutral-400">
            {mode === "following" ? "Follow some accounts to see their posts here." : "No posts yet. Be the first!"}
          </p>
        )}

        {data?.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        <div ref={sentinelRef} aria-hidden className="h-1" />

        {isLoadingMore && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
        {!isLoading && !hasMore && (data?.posts.length ?? 0) > 0 && (
          <p className="p-6 text-center text-sm text-neutral-400">You're all caught up.</p>
        )}
      </div>
    </div>
  );
}
