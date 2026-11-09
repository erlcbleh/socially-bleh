import { profilePath } from "../../lib/communityPath";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LuSearch } from "react-icons/lu";
import { Modal } from "./Modal";
import { Avatar } from "./Avatar";
import { UserBadges } from "./UserBadges";
import { FollowButton } from "./FollowButton";
import { useFollowers, useFollowing } from "../../hooks/useProfile";
import { useAuth } from "../../lib/authContext";

export function FollowListModal({
  username,
  mode,
  onClose,
}: {
  username: string;
  mode: "followers" | "following" | null;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const followers = useFollowers(mode === "followers" ? username : undefined);
  const following = useFollowing(mode === "following" ? username : undefined);
  const { data, error, isLoading, isLoadingMore, loadMore, loadMoreError } =
    mode === "followers" ? followers : following;

  const q = query.trim().toLowerCase();
  const users = data?.users.filter(
    (u) => !q || u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q)
  );

  return (
    <Modal open={!!mode} onClose={onClose} title={mode === "followers" ? "Followers" : "Following"}>
      {!data?.hidden && data && data.users.length > 0 && (
        <div className="relative mb-5">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-neutral-300 bg-transparent py-1.5 pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-neutral-700"
          />
        </div>
      )}
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {isLoading && <p className="py-6 text-center text-neutral-400">Loading…</p>}
        {error && <p className="py-6 text-center text-red-500">{error.message}</p>}
        {data?.hidden && <p className="py-6 text-center text-neutral-400">This person has hidden who they follow.</p>}
        {!data?.hidden && data?.users.length === 0 && <p className="py-6 text-center text-neutral-400">Nobody here yet.</p>}
        {!data?.hidden && data && data.users.length > 0 && users?.length === 0 && (
          <p className="py-6 text-center text-neutral-400">No matches.</p>
        )}
        {!data?.hidden && users?.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2">
            <Link to={profilePath(u.username)} onClick={onClose} className="group flex min-w-0 items-center gap-2">
              <Avatar user={u} size={9} />
              <div className="min-w-0">
                <div className="flex items-center gap-1 truncate text-sm font-medium group-hover:underline">
                  {u.displayName}
                  <UserBadges user={u} className="h-3.5 w-3.5" />
                </div>
                <p className="truncate text-sm text-neutral-500">@{u.username}</p>
              </div>
            </Link>
            {u.id !== me?.id && <FollowButton user={u} className="!px-3 !py-1 text-xs" />}
          </div>
        ))}
        {!data?.hidden && data?.hasMore && data.nextCursor && (
          <div className="flex justify-center pt-2">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
        {loadMoreError && <p className="text-center text-sm text-red-500">{loadMoreError.message}</p>}
      </div>
    </Modal>
  );
}
