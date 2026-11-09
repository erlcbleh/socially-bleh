import { useEffect, useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { api } from "../lib/api";
import { CLIENT_URL } from "../lib/links";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { absoluteTime, relativeTime } from "../lib/time";
import { TransferCommunityDialog } from "../components/TransferCommunityDialog";
import {
  ActionButton,
  Field,
  Meta,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Row,
  Tag,
  TextInput,
} from "../components/panelKit";
import type { ReportTargetUser } from "../types";

interface CommunityRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  joinPolicy: string;
  isGlobal: boolean;
  memberCount: number;
  postCount: number;
  createdAt: string;
  owner: ReportTargetUser | null;
}

function communityPageUrl(slug: string) {
  return `${CLIENT_URL}/c/${slug}`;
}

function openCommunity(slug: string) {
  window.open(communityPageUrl(slug), "_blank", "noopener,noreferrer");
}

function OwnerLink({ user }: { user: ReportTargetUser | null }) {
  if (!user) return <span className="text-[13px] text-neutral-500">No owner on record</span>;
  return (
    <button
      onClick={() => {
        setSelection("user", user.username);
        openPanel({ panelId: "users.dossier" });
      }}
      className="text-[13px] text-neutral-300 underline decoration-white/25 underline-offset-2 hover:decoration-white"
    >
      @{user.username}
    </button>
  );
}

export function Communities() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<CommunityRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const q = useQuery<{ communities: CommunityRow[] }>({
    queryKey: ["staff", "communities", search],
    queryFn: () =>
      api.get<{ communities: CommunityRow[] }>(`/communities?q=${encodeURIComponent(search)}`),
  });

  const communities = q.data?.communities ?? [];

  return (
    <PanelShell>
      <PanelToolbar>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Search name or slug"
          className="min-w-0 flex-1"
        />
        <span className="text-[13px] text-neutral-500">{communities.length}</span>
      </PanelToolbar>

      <PanelScroll>
        <QueryState
          isLoading={q.isLoading}
          error={q.error}
          isEmpty={communities.length === 0}
          emptyLabel="No communities found."
        />

        {communities.map((community) => {
          const isOpen = expanded === community.id;
          return (
            <div key={community.id}>
              <Row
                onClick={() => setExpanded((current) => (current === community.id ? null : community.id))}
                selected={isOpen}
              >
                <div className="flex items-center gap-2">
                  {community.logoUrl ? (
                    <img
                      src={community.logoUrl}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-panel-hover text-[11px] font-semibold text-neutral-400">
                      {community.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate text-sm font-medium text-neutral-200">
                    {community.name}
                  </span>
                  <Tag tone="low">/{community.slug}</Tag>
                  {community.isGlobal ? <Tag tone="medium">global</Tag> : null}
                  {!community.owner ? <Tag tone="high">no owner</Tag> : null}
                  <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                    {community.memberCount.toLocaleString()} members
                  </span>
                </div>
              </Row>

              {isOpen ? (
                <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                  {community.description ? (
                    <Field label="Description">
                      <span className="whitespace-pre-wrap break-words">{community.description}</span>
                    </Field>
                  ) : null}

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Members">{community.memberCount.toLocaleString()}</Field>
                    <Field label="Posts">{community.postCount.toLocaleString()}</Field>
                    <Field label="Join policy">{community.joinPolicy}</Field>
                  </div>

                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Owner</div>
                    <OwnerLink user={community.owner} />
                  </div>

                  <Field label="Created">{absoluteTime(community.createdAt)}</Field>

                  <div className="text-[12px] text-neutral-500">
                    Created {relativeTime(community.createdAt)}
                  </div>

                  <Meta>
                    <ActionButton
                      onClick={() => openCommunity(community.slug)}
                      title={`Open /${community.slug} on socially`}
                    >
                      Open page
                    </ActionButton>

                    {community.isGlobal ? null : (
                      <ActionButton
                        tone="primary"
                        onClick={() => setTransferTarget(community)}
                        title="Assign a new owner to this community"
                      >
                        Transfer ownership
                      </ActionButton>
                    )}
                  </Meta>
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelScroll>

      {transferTarget ? (
        <TransferCommunityDialog
          community={{ id: transferTarget.id, name: transferTarget.name, slug: transferTarget.slug }}
          currentOwner={transferTarget.owner}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => {
            setTransferTarget(null);
            q.refetch();
          }}
        />
      ) : null}
    </PanelShell>
  );
}
