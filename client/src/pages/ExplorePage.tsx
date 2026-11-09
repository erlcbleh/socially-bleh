import { communityPath, profilePath } from "../lib/communityPath";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "../lib/queryStore";
import { LuSearch, LuTrendingUp } from "react-icons/lu";
import { api } from "../lib/api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useCommunitySlug, useNavCommunitySlug } from "../hooks/useCommunitySlug";
import { useTrending } from "../hooks/useTrending";
import { Avatar } from "../components/shared/Avatar";
import { UserBadges } from "../components/shared/UserBadges";
import { FollowButton } from "../components/shared/FollowButton";
import { PostCard } from "../components/post/PostCard";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import type { Post, User } from "../types";

export default function ExplorePage() {
  const slug = useCommunitySlug();
  const navSlug = useNavCommunitySlug();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const q = useDebouncedValue(query.trim(), 300);
  const lastSyncedQ = useRef(q);
  const { data: trendingData } = useTrending();

  useEffect(() => {
    lastSyncedQ.current = q;
    setParams(q ? { q } : {}, { replace: true });
  }, [q]);

  useEffect(() => {
    const urlQ = params.get("q") || "";
    if (urlQ !== lastSyncedQ.current) {
      lastSyncedQ.current = urlQ;
      setQuery(urlQ);
    }
  }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", q, slug],
    queryFn: () => api.get<{ users: User[]; posts: Post[] }>(`/communities/${slug}/search?q=${encodeURIComponent(q)}`),
    enabled: !!q,
  });

  return (
    <div>
      {!q && (
        <div className="p-4 space-y-6">
          {!!trendingData?.tags?.length && (
            <div>
              <div className="flex items-center gap-2 mb-3 px-1 text-lg font-semibold">
                <LuTrendingUp className="h-5 w-5 text-brand" />
                <span>Trending Hashtags</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {trendingData.tags.map((t) => (
                  <Link
                    key={t.tag}
                    to={communityPath(navSlug || slug, `explore?q=${encodeURIComponent(t.tag)}`)}
                    className="block rounded-lg border border-neutral-200 p-3 transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    <p className="font-medium text-brand truncate">{t.tag}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {t.count.toLocaleString()} {t.count === 1 ? "post" : "posts"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 p-4 text-center dark:border-neutral-800">
            <LuSearch className="mx-auto h-8 w-8 text-neutral-400 mb-2" />
            <p className="text-sm font-medium">Search Socially</p>
            <p className="text-xs text-neutral-500 mt-1">
              Type in the search bar above to find people, topics, or posts.
            </p>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}

      {data && (
        <div>
          {data.users.length > 0 && (
            <div>
              {data.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 p-4 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50">
                  <Link to={profilePath(u.username)} className="flex min-w-0 items-center gap-2">
                    <Avatar user={u} size={11} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate font-medium">
                        {u.displayName}
                        <UserBadges user={u} className="h-3.5 w-3.5" />
                      </div>
                      <p className="truncate text-sm text-neutral-500">@{u.username}</p>
                    </div>
                  </Link>
                  <FollowButton user={u} />
                </div>
              ))}
            </div>
          )}

          {data.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}

          {data.users.length === 0 && data.posts.length === 0 && (
            <p className="p-6 text-center text-neutral-400">No results for "{q}"</p>
          )}
        </div>
      )}
    </div>
  );
}
