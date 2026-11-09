import { useState } from "react";
import { LuSearch } from "react-icons/lu";
import { useMutation, useQuery, useQueryClient } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { Avatar } from "../../components/shared/Avatar";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import type { CommunityMember } from "../../types";
import { useConfirm } from "../../components/shared/ConfirmDialog";

interface MemberPage {
  members: CommunityMember[];
  totalMembers: number;
  onlineMembers: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export default function CommunityStaffSettings() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const pageScope = `${slug}\n${debouncedQuery}`;
  const [extraPageState, setExtraPageState] = useState<{ scope: string; pages: MemberPage[] }>({ scope: "", pages: [] });

  const { data, isLoading } = useQuery({
    queryKey: ["community", slug, "members", "active", debouncedQuery],
    queryFn: () =>
      api.get<MemberPage>(
        `/communities/${slug}/members?limit=50&status=active&q=${encodeURIComponent(debouncedQuery)}`
      ),
  });

  const loadMore = useMutation({
    mutationFn: ({ cursor, q }: { cursor: string; q: string; scope: string }) =>
      api.get<MemberPage>(
        `/communities/${slug}/members?limit=50&status=active&q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(cursor)}`
      ),
    onSuccess: (page, request) => {
      if (request.scope !== pageScope) return;
      setExtraPageState((current) => ({
        scope: request.scope,
        pages: current.scope === request.scope ? [...current.pages, page] : [page],
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: ({ username, action }: { username: string; action: "promote" | "demote" }) =>
      api.post(`/communities/${slug}/members/${username}/${action}`),
    onSuccess: () => {
      setExtraPageState({ scope: pageScope, pages: [] });
      queryClient.invalidateQueries({ queryKey: ["community", slug, "members"] });
    },
  });

  const extraPages = extraPageState.scope === pageScope ? extraPageState.pages : [];
  const tailPage = extraPages.at(-1) ?? data;
  const seenMemberIds = new Set<string>();
  const members = [...(data?.members ?? []), ...extraPages.flatMap((page) => page.members)].filter((member) => {
    if (seenMemberIds.has(member.id)) return false;
    seenMemberIds.add(member.id);
    return true;
  });

  const { confirm, dialog } = useConfirm(setRole.isPending);

  return (
    <div className="max-w-lg space-y-2">
      {dialog}
      <p className="text-sm text-neutral-500">Staff can kick/ban members, delete posts, and review reports within this community.</p>

      <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-900">
        <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members by name or username..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center p-6">
          <FlickerSpinner />
        </div>
      )}

      {!isLoading && debouncedQuery && members.length === 0 && (
        <p className="p-3 text-center text-sm text-neutral-400">No members match "{debouncedQuery}".</p>
      )}

      {members.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar user={m} size={9} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">@{m.username}</p>
              <p className="text-xs capitalize text-neutral-500">{m.communityRole}</p>
            </div>
          </div>
          {m.communityRole === "owner" ? null : m.communityRole === "staff" ? (
            <button
              onClick={() =>
                confirm({
                  title: `Remove @${m.username} as staff?`,
                  description: "They lose moderation access in this community.",
                  confirmLabel: "Remove staff",
                  tone: "danger",
                  onConfirm: () => setRole.mutate({ username: m.username, action: "demote" }),
                })
              }
              disabled={setRole.isPending}
              className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Remove staff
            </button>
          ) : (
            <button
              onClick={() =>
                confirm({
                  title: `Make @${m.username} staff?`,
                  description: "They can moderate members and content in this community.",
                  confirmLabel: "Make staff",
                  onConfirm: () => setRole.mutate({ username: m.username, action: "promote" }),
                })
              }
              disabled={setRole.isPending}
              className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Make staff
            </button>
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
    </div>
  );
}
