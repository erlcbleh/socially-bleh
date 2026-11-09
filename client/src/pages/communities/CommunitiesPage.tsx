import { communityPath } from "../../lib/communityPath";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LuKeyRound, LuLogIn, LuPlus, LuLogOut, LuSearch, LuCompass, LuPin } from "react-icons/lu";
import {
  useMyCommunities,
  useJoinCommunity,
  useDiscoverCommunities,
  useJoinOpenCommunity,
} from "../../hooks/useCommunities";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { Modal } from "../../components/shared/Modal";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import { Avatar } from "../../components/shared/Avatar";
import { colorForCommunity } from "../../lib/communityColor";
import { useAuth } from "../../lib/authContext";
import { useQueryClient, useMutation } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { disableGuestMode } from "../../lib/guestMode";
import { GlobalCommunityMark } from "../../components/shared/GlobalCommunityMark";

function AccountBar() {
  const { user, refetch } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const logout = async () => {
    await api.post("/auth/logout");
    disableGuestMode();
    queryClient.clear();
    refetch();
    navigate("/");
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Account menu"
          className="flex items-center justify-center rounded-full ring-2 ring-white dark:ring-black"
        >
          <Avatar user={user} size={11} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              <div className="border-b border-neutral-100 px-4 py-2 text-left dark:border-neutral-800">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="truncate text-xs text-neutral-500">@{user.username}</p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-neutral-50 dark:text-red-400 dark:hover:bg-neutral-800"
              >
                <LuLogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JoinCommunityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const joinCommunity = useJoinCommunity();
  const [code, setCode] = useState("");

  const handleJoin = () => {
    if (!code.trim()) return;
    joinCommunity.mutate(code.trim(), {
      onSuccess: (res) => {
        navigate(communityPath(res.community.slug));
      },
    });
  };

  const handleClose = () => {
    setCode("");
    joinCommunity.reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Join a community">
      <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Invite code <span className="text-red-500">*</span>
      </label>
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        placeholder="Invite code"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
      />
      {joinCommunity.isError && <p className="mt-2 text-sm text-red-500">{(joinCommunity.error as Error).message}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleClose}
          className="rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Close
        </button>
        <button
          onClick={handleJoin}
          disabled={!code.trim() || joinCommunity.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <LuLogIn className="h-4 w-4" />
          {joinCommunity.isPending ? "Joining…" : "Join"}
        </button>
      </div>
    </Modal>
  );
}

function ExplorePanel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data, isLoading } = useDiscoverCommunities(debouncedQuery);
  const queryClient = useQueryClient();
  const joinOpen = useJoinOpenCommunity();
  const leaveCommunity = useMutation({
    mutationFn: (slug: string) => api.post(`/communities/${slug}/leave`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communities"] }),
  });
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const communities = data?.communities ?? [];

  const join = (slug: string) => {
    setPendingSlug(slug);
    joinOpen.mutate(slug, { onSuccess: () => navigate(communityPath(slug)) });
  };

  const leave = (slug: string) => {
    leaveCommunity.mutate(slug);
  };

  return (
    <div className="text-left">
      <div className="relative mb-6">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search communities"
          className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <FlickerSpinner />
        </div>
      )}

      {!isLoading && communities.length === 0 && (
        <p className="py-10 text-center text-neutral-500">
          {debouncedQuery ? "No communities match that search." : "No public communities yet. Check back soon."}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {communities.map((c) => {
          const isMember = c.myStatus === "active";
          const isBanned = c.myStatus === "banned";

          return (
            <div
              key={c.id}
              className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-transparent">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt={c.name} className="h-full w-full bg-transparent object-cover" />
                ) : (
                  <div className={`h-full w-full ${colorForCommunity(c.id)}`} />
                )}
              </div>
              <div className="w-full min-w-0 flex-1">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-neutral-500">
                  {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                </p>
                {c.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{c.description}</p>}
              </div>

              {isBanned ? (
                <span className="text-sm text-red-500">You're banned from this community</span>
              ) : isMember ? (
                <div className="flex w-full gap-2">
                  <button
                    onClick={() => navigate(communityPath(c.slug))}
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => leave(c.slug)}
                    disabled={leaveCommunity.isPending}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Leave
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => join(c.slug)}
                  disabled={joinOpen.isPending}
                  className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-40"
                >
                  {joinOpen.isPending && pendingSlug === c.slug ? "Joining…" : "Join"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {joinOpen.isError && (
        <p className="mt-4 text-center text-sm text-red-500">{(joinOpen.error as Error).message}</p>
      )}
    </div>
  );
}

export default function CommunitiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useMyCommunities();
  const leaveCommunity = useMutation({
    mutationFn: (slug: string) => api.post(`/communities/${slug}/leave`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communities"] }),
  });
  const [joinOpen, setJoinOpen] = useState(false);
  const [tab, setTab] = useState<"mine" | "explore">("mine");
  const rawCommunities = data?.communities ?? [];
  const [pinnedSlugs, setPinnedSlugs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("socially_pinned_communities");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (e: React.MouseEvent, communitySlug: string) => {
    e.stopPropagation();
    setPinnedSlugs((prev) => {
      const next = prev.includes(communitySlug)
        ? prev.filter((s) => s !== communitySlug)
        : [...prev, communitySlug];
      try {
        localStorage.setItem("socially_pinned_communities", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const communities = [...rawCommunities].sort((a, b) => {
    if (a.isGlobal || a.slug === "global") return -1;
    if (b.isGlobal || b.slug === "global") return 1;
    const aPinned = pinnedSlugs.includes(a.slug);
    const bPinned = pinnedSlugs.includes(b.slug);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  const enterCommunity = (slug: string) => {
    navigate(communityPath(slug));
  };

  const hasCommunities = !isLoading && communities.length > 0;

  const buttons = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={() => setTab("explore")}
        className="flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-medium text-white hover:bg-brand-dark"
      >
        <LuCompass className="h-4 w-4" />
        Explore communities
      </button>
      <button
        onClick={() => setJoinOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        <LuKeyRound className="h-4 w-4" />
        Enter invite code
      </button>
      <Link
        to="/communities/new"
        className="flex items-center gap-2 rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        <LuPlus className="h-4 w-4" />
        Create a community
      </Link>
    </div>
  );

  const title = (
    <div>
      <h1 className="text-3xl font-semibold">Join a community</h1>
      <p className="mx-auto mt-3 max-w-md text-neutral-500">
        Use an invite code from a community owner, or create your own private space.
      </p>
    </div>
  );

  if (tab === "explore") {
    return (
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Explore communities</h1>
          <button
            onClick={() => setTab("mine")}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Your communities
          </button>
        </div>

        <ExplorePanel />
        <AccountBar />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-4xl px-6 text-center ${hasCommunities ? "py-16" : "flex min-h-[calc(100svh-4rem)] flex-col"}`}>
      {hasCommunities ? (
        <>
          <h1 className="mb-10 text-3xl font-semibold">Communities</h1>

          <div className="text-left">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communities.map((c) => {
                const isPinned = pinnedSlugs.includes(c.slug);
                const isGlobal = c.isGlobal || c.slug === "global";

                return (
                  <div
                    key={c.id}
                    onClick={() => enterCommunity(c.slug)}
                    className="group relative flex flex-col items-start gap-3 rounded-xl border border-neutral-200 p-4 text-left transition-colors duration-200 hover:border-brand dark:border-neutral-800 dark:hover:border-brand cursor-pointer"
                  >
                    {!isGlobal && (
                      <button
                        type="button"
                        onClick={(e) => togglePin(e, c.slug)}
                        title={isPinned ? "Unpin community" : "Pin community"}
                        className={`absolute right-3 top-3 rounded-full p-1.5 transition-opacity ${
                          isPinned
                            ? "text-brand opacity-100 hover:text-brand-dark"
                            : "text-neutral-400 opacity-0 hover:text-neutral-600 dark:hover:text-neutral-200 group-hover:opacity-100"
                        }`}
                      >
                        <LuPin className={`h-4 w-4 ${isPinned ? "fill-current" : ""}`} />
                      </button>
                    )}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-transparent">
                      {c.isGlobal ? (
                        <GlobalCommunityMark className="h-8 w-8" />
                      ) : c.logoUrl ? (
                        <img src={c.logoUrl} alt={c.name} className="h-full w-full bg-transparent object-cover" />
                      ) : (
                        <div className={`h-full w-full ${colorForCommunity(c.id)}`} />
                      )}
                    </div>
                    <div className="min-w-0 w-full flex-1">
                      <p className="truncate font-medium pr-6">{c.name}</p>
                      <p className="text-xs text-neutral-500">
                        {c.memberCount} {c.memberCount === 1 ? "member" : "members"}
                      </p>
                      {c.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{c.description}</p>
                      )}
                    </div>
                    {!isGlobal && (
                      <div className="mt-auto w-full pt-2 border-t border-neutral-100 dark:border-neutral-800/60 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveCommunity.mutate(c.slug);
                          }}
                          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Leave community
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-14">{buttons}</div>
        </>
      ) : (
        <>
          <div className="flex-1" />
          {title}
          <div className="flex flex-1 flex-col items-center">
            <div className="mt-6">{buttons}</div>
            <Link
              to="/"
              className="mt-5 text-sm text-neutral-500 underline underline-offset-4 hover:text-black dark:hover:text-white"
            >
              Skip this step for now
            </Link>
            {isLoading && (
              <div className="mt-12 flex justify-center">
                <FlickerSpinner />
              </div>
            )}
          </div>
        </>
      )}

      <JoinCommunityModal open={joinOpen} onClose={() => setJoinOpen(false)} />
      <AccountBar />
    </div>
  );
}
