import { profilePath } from "../../lib/communityPath";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LuSearch, LuUserMinus, LuBan, LuBadgeCheck } from "react-icons/lu";
import { useMutation, useQuery, useQueryClient } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useCommunity } from "../../lib/communityContext";
import { useAuth } from "../../lib/authContext";
import { Avatar } from "../../components/shared/Avatar";
import { Modal } from "../../components/shared/Modal";
import { UserVerifiedBadge } from "../../components/shared/VerifiedBadge";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import { DURATION_PRESETS } from "../../lib/moderation";
import type { CommunityMember } from "../../types";
import { useConfirm } from "../../components/shared/ConfirmDialog";

interface MemberPage {
  members: CommunityMember[];
  totalMembers: number;
  onlineMembers: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export default function CommunityMembersPage() {
  const slug = useCommunitySlug();
  const { community } = useCommunity();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [confirmTarget, setConfirmTarget] = useState<{ username: string; kind: "kick" | "ban" | "unban" } | null>(null);
  const [reason, setReason] = useState("");
  const [banChoice, setBanChoice] = useState("permanent");
  const [banCustomDate, setBanCustomDate] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const pageScope = `${slug}\n${debouncedQuery}`;
  const [extraPageState, setExtraPageState] = useState<{ scope: string; pages: MemberPage[] }>({ scope: "", pages: [] });

  const { data, isLoading } = useQuery({
    queryKey: ["community", slug, "members", "all", debouncedQuery],
    queryFn: () =>
      api.get<MemberPage>(`/communities/${slug}/members?limit=50&q=${encodeURIComponent(debouncedQuery)}`),
    refetchInterval: 30_000,
  });

  const loadMore = useMutation({
    mutationFn: ({ cursor, q }: { cursor: string; q: string; scope: string }) =>
      api.get<MemberPage>(
        `/communities/${slug}/members?limit=50&q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}`
      ),
    onSuccess: (page, request) => {
      if (request.scope !== pageScope) return;
      setExtraPageState((current) => ({
        scope: request.scope,
        pages: current.scope === request.scope ? [...current.pages, page] : [page],
      }));
    },
  });

  const moderate = useMutation({
    mutationFn: ({ username, kind, reason, until }: { username: string; kind: "kick" | "ban" | "unban"; reason?: string; until?: string | null }) =>
      api.post(`/communities/${slug}/members/${username}/${kind}`, { reason, until }),
    onSuccess: () => {
      setExtraPageState({ scope: pageScope, pages: [] });
      queryClient.invalidateQueries({ queryKey: ["community", slug, "members"] });
      setConfirmTarget(null);
      setReason("");
      setBanChoice("permanent");
      setBanCustomDate("");
    },
  });

  const invite = useMutation({
    mutationFn: (username: string) => api.post(`/communities/${slug}/verification/members/${username}/invite`),
    onSuccess: () => {
      setExtraPageState({ scope: pageScope, pages: [] });
      queryClient.invalidateQueries({ queryKey: ["community", slug, "members"] });
    },
  });

  const closeModal = () => {
    setConfirmTarget(null);
    setReason("");
    setBanChoice("permanent");
    setBanCustomDate("");
  };

  const banUntil = (): string | null => {
    if (banChoice === "permanent") return null;
    if (banChoice === "custom") return banCustomDate ? new Date(banCustomDate).toISOString() : null;
    const preset = DURATION_PRESETS.find((p) => p.label === banChoice);
    return preset ? new Date(Date.now() + preset.ms).toISOString() : null;
  };

  const extraPages = extraPageState.scope === pageScope ? extraPageState.pages : [];
  const tailPage = extraPages.at(-1) ?? data;
  const seenMemberIds = new Set<string>();
  const members = [...(data?.members ?? []), ...extraPages.flatMap((page) => page.members)].filter((member) => {
    if (seenMemberIds.has(member.id)) return false;
    seenMemberIds.add(member.id);
    return true;
  });

  const { confirm, dialog } = useConfirm(invite.isPending);

  return (
    <div className="space-y-2">
      {dialog}
      {data && (
        <p className="px-1 text-sm text-neutral-500">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{data.totalMembers}</span> total members ·{" "}
          <span className="inline-flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300">
            {data.onlineMembers}
          </span>{" "}
          online
        </p>
      )}

      <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-900">
        <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members by name or username..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
      </div>

      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}

      {!isLoading && debouncedQuery && members.length === 0 && (
        <p className="p-3 text-center text-sm text-neutral-400">No members match "{debouncedQuery}".</p>
      )}

      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <Link to={profilePath(m.username)} className="flex min-w-0 items-center gap-2">
            <div className="relative shrink-0">
              <Avatar user={m} size={9} />
              {m.isOnline && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-black" />
              )}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-sm font-medium">
                @{m.username}
                <UserVerifiedBadge user={m} className="h-3.5 w-3.5" />
              </p>
              <p className="text-xs capitalize text-neutral-500">
                {m.communityRole} · {m.membershipStatus}
              </p>
            </div>
          </Link>
          {m.communityRole !== "owner" && (
            <div className="flex shrink-0 items-center gap-2">
              {community &&
                !community.verificationApplicationsOnly &&
                ["none", "rejected"].includes(m.communityVerificationStatus) &&
                m.followersCount >= community.verificationFollowerThreshold && (
                  <button
                    onClick={() =>
                      confirm({
                        title: `Invite @${m.username} to verify?`,
                        description: "They get a verification invite they can accept or decline.",
                        confirmLabel: "Send invite",
                        onConfirm: () => invite.mutate(m.username),
                      })
                    }
                    disabled={invite.isPending}
                    aria-label="Invite to verify"
                    title="Invite to verify"
                    className="p-1.5 text-emerald-500 hover:text-emerald-600 disabled:opacity-40"
                  >
                    <LuBadgeCheck className="h-5 w-5" />
                  </button>
                )}
              {m.id !== currentUser?.id &&
                (m.membershipStatus === "banned" ? (
                  <button
                    onClick={() => setConfirmTarget({ username: m.username, kind: "unban" })}
                    className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    Unban
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmTarget({ username: m.username, kind: "kick" })}
                      aria-label="Kick"
                      className="p-1.5 text-amber-500 hover:text-amber-600"
                    >
                      <LuUserMinus className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setConfirmTarget({ username: m.username, kind: "ban" })}
                      aria-label="Ban"
                      className="p-1.5 text-red-600 hover:text-red-700"
                    >
                      <LuBan className="h-5 w-5" />
                    </button>
                  </>
                ))}
            </div>
          )}
        </div>
      ))}

      {tailPage?.hasMore && tailPage.nextCursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() =>
              loadMore.mutate({ cursor: tailPage.nextCursor!, q: debouncedQuery, scope: pageScope })
            }
            disabled={loadMore.isPending}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {loadMore.isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      <Modal
        open={!!confirmTarget}
        onClose={closeModal}
        title={confirmTarget ? `${confirmTarget.kind.charAt(0).toUpperCase()}${confirmTarget.kind.slice(1)} @${confirmTarget.username}?` : ""}
      >
        <div>
          {confirmTarget?.kind === "ban" && (
            <div className="mb-3 space-y-2">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Duration</p>
              {DURATION_PRESETS.map((p) => (
                <label key={p.label} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="banDuration" checked={banChoice === p.label} onChange={() => setBanChoice(p.label)} />
                  {p.label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="banDuration" checked={banChoice === "permanent"} onChange={() => setBanChoice("permanent")} />
                Permanent
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="banDuration" checked={banChoice === "custom"} onChange={() => setBanChoice("custom")} />
                Custom date & time
              </label>
              {banChoice === "custom" && (
                <input
                  type="datetime-local"
                  value={banCustomDate}
                  onChange={(e) => setBanCustomDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              )}

              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={closeModal}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                confirmTarget &&
                moderate.mutate({
                  username: confirmTarget.username,
                  kind: confirmTarget.kind,
                  reason: reason || undefined,
                  until: confirmTarget.kind === "ban" ? banUntil() : undefined,
                })
              }
              disabled={moderate.isPending || (confirmTarget?.kind === "ban" && banChoice === "custom" && !banCustomDate)}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
