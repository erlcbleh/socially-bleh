import { useState } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { useInfiniteQuery, useQuery } from "@socially/shared/queryStore";
import { useConfirm } from "@socially/shared/components/ConfirmDialog";
import { CopyButton } from "@socially/shared/components/CopyButton";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { setSelection, usePinnedSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { JumpTo } from "../components/JumpTo";
import {
  ReportActionDialog,
  type ReportAction,
  type ReportActionPayload,
} from "../components/ReportActionDialog";
import { postUrl, profileUrl } from "../lib/links";
import { absoluteTime, relativeTime } from "../lib/time";
import { ActionButton, Field, LoadMore, Meta, PanelScroll, PanelShell, PanelToolbar, QueryState, Tag, TextInput } from "../components/panelKit";
import { TransferCommunityDialog } from "../components/TransferCommunityDialog";
import { RANK_LEVEL } from "../types";
import type { AuditEntry, AuditPage, DiscordIdentity, UserDossierResponse, UserPostsPage, UserReportsPage } from "../types";

interface Props {
  pinnedId?: string | null;
}

const LABEL_MAX = 280;

const LABEL_PRESETS = [
  "This is a fictional account, if you are in distress or need emergency services call 911 or your local emergency number.",
  "This is a roleplay account and is not affiliated with any real law enforcement or government agency.",
  "Parody account. Not affiliated with the organisation it depicts.",
];

const GRANTABLE_BADGES = [
  { id: "content_creator", label: "Content Creator" },
  { id: "bug_hunter", label: "Bug Hunter" },
  { id: "early_supporter", label: "Early Supporter" },
  { id: "contributor", label: "Contributor" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.08] px-3.5 py-3 last:border-0">
      <div className="text-[12px] font-semibold text-neutral-500">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2">
      <span className="text-sm text-neutral-200">{value}</span>
      <span className="text-[12px] text-neutral-500">{label}</span>
    </div>
  );
}

function DiscordField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-neutral-500">{label}</div>
        <div className="truncate font-mono text-[13px] text-neutral-200">{value || "-"}</div>
      </div>
      {value ? <CopyButton value={value} label={label} /> : null}
    </div>
  );
}

function DiscordSection({ discord }: { discord: DiscordIdentity }) {
  return (
    <Section title="Discord">
      {discord.ban ? (
        <div className="rounded border border-severity-high/30 bg-severity-high/10 px-2.5 py-2 text-[13px] text-severity-high">
          Discord ID is banned{discord.ban.bannedBy ? ` by @${discord.ban.bannedBy}` : ""} on{" "}
          {absoluteTime(discord.ban.createdAt)}
          {discord.ban.reason ? ` - ${discord.ban.reason}` : ""}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <DiscordField label="Discord ID" value={discord.id} />
        <DiscordField label="Username" value={discord.username} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Discord created">
          {discord.accountCreatedAt ? absoluteTime(discord.accountCreatedAt) : "-"}
        </Field>
        <Field label="Profile">
          <a
            href={discord.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-neutral-200 underline decoration-white/25 underline-offset-2 hover:decoration-white"
          >
            Open in Discord
          </a>
        </Field>
      </div>

      {discord.isOwner ? <Tag tone="low">platform owner discord</Tag> : null}

      {discord.linkedAccounts.length ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] text-neutral-500">
            {discord.linkedAccounts.length} other account
            {discord.linkedAccounts.length === 1 ? "" : "s"} on this Discord ID
          </div>
          {discord.linkedAccounts.map((account) => (
            <button
              key={account.id}
              onClick={() => setSelection("user", account.username)}
              className="flex items-center gap-2 rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2 text-left transition-colors hover:bg-panel-hover"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">
                @{account.username}
                <span className="text-neutral-500"> {account.displayName}</span>
              </span>
              <Tag tone="low">{account.accountKind}</Tag>
              {account.status !== "active" ? <Tag tone="high">{account.status}</Tag> : null}
            </button>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

type ContentTab = "posts" | "against" | "filed";

const CONTENT_TABS = [
  { value: "posts" as const, label: "Posts" },
  { value: "against" as const, label: "Reports against" },
  { value: "filed" as const, label: "Reports filed" },
];

function UserContent({ username }: { username: string }) {
  const [tab, setTab] = useState<ContentTab>("posts");

  const posts = useQuery<UserPostsPage>({
    queryKey: ["staff", "dossier", "posts", username],
    queryFn: () => api.get<UserPostsPage>(`/users/${encodeURIComponent(username)}/posts?limit=25&includeDeleted=true`),
    enabled: tab === "posts",
  });

  const reports = useQuery<UserReportsPage>({
    queryKey: ["staff", "dossier", "reports", username, tab],
    queryFn: () =>
      api.get<UserReportsPage>(
        `/users/${encodeURIComponent(username)}/reports?limit=25&direction=${tab === "filed" ? "filed" : "against"}`
      ),
    enabled: tab !== "posts",
  });

  const active = tab === "posts" ? posts : reports;

  return (
    <Section title="Content">
      <div className="flex items-center gap-1">
        {CONTENT_TABS.map((entry) => (
          <button
            key={entry.value}
            onClick={() => setTab(entry.value)}
            className={`rounded px-2.5 py-1.5 text-[13px] transition-colors ${
              tab === entry.value
                ? "bg-white text-black"
                : "text-neutral-400 hover:bg-panel-hover hover:text-neutral-200"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {active.isLoading ? <div className="text-[13px] text-neutral-500">Loading…</div> : null}
      {active.error ? <div className="text-[13px] text-severity-high">{active.error.message}</div> : null}

      {tab === "posts" && posts.data ? (
        posts.data.items.length === 0 ? (
          <div className="text-[13px] text-neutral-500">No posts.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {posts.data.items.map((post) => (
              <div key={post.id} className="rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  {post.deleted ? <Tag tone="high">deleted</Tag> : null}
                  {post.isReply ? <Tag>reply</Tag> : null}
                  {post.isRepost ? <Tag>repost</Tag> : null}
                  {post.hasMedia ? <Tag>media</Tag> : null}
                  {post.moderationStatus && post.moderationStatus !== "clear" ? (
                    <Tag tone="medium">{post.moderationStatus}</Tag>
                  ) : null}
                  <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                    {relativeTime(post.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-[13px] text-neutral-300">
                  {post.content || <span className="italic text-neutral-500">No text content</span>}
                </p>
                <div className="mt-2 flex justify-end">
                  <JumpTo
                    href={postUrl(username, post.id, post.communitySlug)}
                    label="Open post"
                    disabled={post.deleted}
                    disabledReason="This post was deleted"
                  />
                </div>
              </div>
            ))}
            {posts.data.nextCursor ? (
              <div className="text-[12px] text-neutral-500">Showing the 25 most recent.</div>
            ) : null}
          </div>
        )
      ) : null}

      {tab !== "posts" && reports.data ? (
        reports.data.items.length === 0 ? (
          <div className="text-[13px] text-neutral-500">
            {tab === "filed" ? "This account has filed no reports." : "No reports against this account."}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {reports.data.items.map((report) => (
              <div
                key={report.id}
                className="rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2 transition-colors hover:border-white/20"
              >
                <button
                  onClick={() => {
                    setSelection("report", report.id);
                    openPanel({ panelId: "reports.workspace" });
                  }}
                  className="w-full text-left"
                >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] text-neutral-200">{report.reason}</span>
                  <Tag tone={report.status === "pending" ? "medium" : report.status === "actioned" ? "high" : "neutral"}>
                    {report.status}
                  </Tag>
                  {report.source === "ai" ? <Tag>AI</Tag> : null}
                  <span className="ml-auto shrink-0 text-[12px] text-neutral-500">
                    {relativeTime(report.createdAt)}
                  </span>
                </div>
                {report.content ? (
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-neutral-500">{report.content}</p>
                ) : null}
                </button>

                {report.targetType === "post" ? (
                  <div className="mt-2 flex justify-end">
                    <JumpTo
                      href={postUrl(report.targetAuthor, report.targetId, report.targetCommunitySlug)}
                      label="Open post"
                      disabled={report.targetDeleted}
                      disabledReason="This post was deleted"
                    />
                  </div>
                ) : null}
              </div>
            ))}
            {reports.data.nextCursor ? (
              <div className="text-[12px] text-neutral-500">Showing the 25 most recent.</div>
            ) : null}
          </div>
        )
      ) : null}
    </Section>
  );
}

function UserAuditLog({ username }: { username: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useInfiniteQuery<AuditPage>({
    queryKey: ["staff", "dossier", "audit", username],
    queryFn: (pageParam) => {
      const search = new URLSearchParams({ limit: "25" });
      if (pageParam) search.set("cursor", String(pageParam));
      return api.get<AuditPage>(`/users/${encodeURIComponent(username)}/audit-log?${search.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const entries = query.pages.flatMap((page) => page.items);

  if (query.error) {
    return (
      <Section title="Logs">
        <div className="text-[13px] text-severity-high">{query.error.message}</div>
      </Section>
    );
  }

  if (query.isLoading && entries.length === 0) {
    return (
      <Section title="Logs">
        <div className="text-[13px] text-neutral-500">Loading…</div>
      </Section>
    );
  }

  if (entries.length === 0) {
    return (
      <Section title="Logs">
        <div className="text-[13px] text-neutral-500">No staff actions on this account.</div>
      </Section>
    );
  }

  return (
    <Section title={`Logs (${entries.length}${query.hasNextPage ? "+" : ""})`}>
      <div className="flex flex-col gap-1">
        {entries.map((entry: AuditEntry) => {
          const isOpen = expanded === entry.id;
          return (
            <div
              key={entry.id}
              className="rounded-lg border border-panel-border bg-panel-raised"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : entry.id)}
                className="w-full px-2.5 py-2 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] text-neutral-200">{entry.action}</span>
                  <Tag>{entry.targetType}</Tag>
                  {entry.important ? <Tag tone="medium">Kept</Tag> : null}
                  {entry.undone ? <Tag tone="low">undone</Tag> : null}
                  <span
                    className="ml-auto shrink-0 text-[12px] text-neutral-500"
                    title={absoluteTime(entry.createdAt)}
                  >
                    {relativeTime(entry.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-neutral-500">
                  by {entry.staff ? `@${entry.staff.username}` : "system"}
                  {entry.targetLabel ? ` · ${entry.targetLabel}` : ""}
                </div>
              </button>
              {isOpen && entry.meta ? (
                <pre className="max-h-56 overflow-auto border-t border-white/[0.06] px-2.5 py-2 text-[12px] leading-relaxed text-neutral-400">
                  {JSON.stringify(entry.meta, null, 2)}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>
      {query.hasNextPage ? <LoadMore onClick={() => query.fetchNextPage()} /> : null}
    </Section>
  );
}

export function UserDossier({ pinnedId }: Props) {
  const username = usePinnedSelection("user", pinnedId);
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [badgeBusy, setBadgeBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ReportAction | null>(null);
  const [labelEditing, setLabelEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelBusy, setLabelBusy] = useState(false);
  const [transferCommunity, setTransferCommunity] = useState<{ id: string; name: string; slug: string } | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm(busy || labelBusy);

  const isAdmin = RANK_LEVEL[user?.role ?? "user"] >= RANK_LEVEL.admin;

  const query = useQuery<UserDossierResponse>({
    queryKey: ["staff", "dossier", username],
    queryFn: () => api.get<UserDossierResponse>(`/users/${encodeURIComponent(username || "")}/details`),
    enabled: Boolean(username),
  });

  const data = query.data;

  const submitModeration = (payload: ReportActionPayload | { action: "reinstate"; reason: string }) => {
    if (!username) return;

    setBusy(true);
    setError(null);
    api
      .post(`/users/${encodeURIComponent(username)}/moderate`, payload)
      .then(() => {
        setPendingAction(null);
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const saveLabel = (next: string) => {
    if (!username) return;
    setError(null);
    setLabelBusy(true);
    api
      .put(`/users/${encodeURIComponent(username)}/label`, { label: next })
      .then(() => {
        setLabelEditing(false);
        setLabelDraft("");
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLabelBusy(false));
  };

  const toggleBadge = (badge: string, has: boolean) => {
    if (!username) return;

    setBadgeBusy(badge);
    setError(null);
    api
      .post(`/users/${encodeURIComponent(username)}/badges`, { action: has ? "remove" : "add", badge })
      .then(() => query.refetch())
      .catch((err: Error) => setError(err.message))
      .finally(() => setBadgeBusy(null));
  };

  const resetUsername = () => {
    if (!username) return;

    confirm({
      title: `Reset @${username}'s username?`,
      description: (
        <>
          This changes their username to something like <code>user123456789</code> and clears their
          30-day cooldown so they can pick a new one immediately. Their current username will be
          released and available for anyone else to claim right away. Continue?
        </>
      ),
      confirmLabel: "Continue",
      tone: "danger",
      onConfirm: () => {
        setTimeout(() => {
          confirm({
            title: `Really reset @${username}?`,
            description: "Second confirmation. This action is logged and cannot be undone.",
            confirmLabel: "Yes, reset username",
            tone: "danger",
            onConfirm: () => {
              setTimeout(() => {
                confirm({
                  title: `Final check: reset @${username}?`,
                  description: "Last chance to back out. Their username will be replaced right away.",
                  confirmLabel: "Reset it",
                  tone: "danger",
                  onConfirm: () => {
                    setBusy(true);
                    setError(null);
                    api
                      .post<{ user: { username: string } }>(
                        `/users/${encodeURIComponent(username)}/reset-username`,
                        {}
                      )
                      .then((res) => {
                        setSelection("user", res.user.username);
                        return query.refetch();
                      })
                      .catch((err: Error) => setError(err.message))
                      .finally(() => setBusy(false));
                  },
                });
              }, 0);
            },
          });
        }, 0);
      },
    });
  };

  const reinstate = () => {
    if (!username) return;

    confirm({
      title: `Reinstate @${username}`,
      description: "Restores the account and lifts any active suspension.",
      confirmLabel: "Reinstate",
      onConfirm: () => submitModeration({ action: "reinstate", reason: "" }),
    });
  };

  if (!username) {
    return (
      <PanelShell>
        <div className="flex h-full items-center justify-center p-6 text-center">
          <p className="max-w-xs text-sm text-neutral-500">
            Pick an account in User Search, or click a reported user, to open its dossier.
          </p>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      {confirmDialog}
      <ReportActionDialog
        action={pendingAction}
        targetLabel={`@${username}`}
        isAdmin={isAdmin}
        isSubmitting={busy}
        onCancel={() => setPendingAction(null)}
        onSubmit={submitModeration}
      />
      <PanelToolbar>
        <span className="truncate text-sm font-semibold text-neutral-200">@{username}</span>
        {data?.user.isVerified ? <Tag tone="low">verified</Tag> : null}
        {data?.account.suspendedUntil || data?.user.status !== "active" ? (
          <Tag tone="high">{data?.user.status}</Tag>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <ActionButton onClick={() => setPendingAction("suspend")} tone="danger" disabled={busy}>
            Suspend
          </ActionButton>
          <ActionButton onClick={() => setPendingAction("deactivate")} tone="danger" disabled={busy}>
            Deactivate
          </ActionButton>
          <ActionButton onClick={reinstate} disabled={busy}>
            Reinstate
          </ActionButton>
          {isAdmin ? (
            <ActionButton onClick={resetUsername} tone="danger" disabled={busy}>
              Reset username
            </ActionButton>
          ) : null}
        </div>
      </PanelToolbar>

      {error ? <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">{error}</div> : null}

      <PanelScroll>
        <QueryState isLoading={query.isLoading} error={query.error} isEmpty={!data} emptyLabel="No account found." />

        {data ? (
          <>
            <Section title="Account">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Display name">{data.user.displayName}</Field>
                <Field label="Role">{data.user.role}</Field>
                <Field label="Joined">{absoluteTime(data.account.createdAt)}</Field>
                <Field label="Last active">
                  {data.account.lastActiveAt ? relativeTime(data.account.lastActiveAt) : "-"}
                </Field>
                <Field label="Verification">{data.account.verificationStatus}</Field>
              </div>

              {data.account.suspendReason ? (
                <div className="rounded border border-severity-high/30 bg-severity-high/10 px-2.5 py-2 text-[13px] text-severity-high">
                  {data.account.suspendReason}
                  {data.account.suspendedUntil ? `until ${absoluteTime(data.account.suspendedUntil)}` : "permanent"}
                </div>
              ) : null}
            </Section>

            <Section title="Badges">
              <div className="flex flex-wrap gap-1.5">
                {GRANTABLE_BADGES.map((badge) => {
                  const has = (data.user.badges ?? []).includes(badge.id);
                  return (
                    <button
                      key={badge.id}
                      onClick={() => toggleBadge(badge.id, has)}
                      disabled={badgeBusy === badge.id}
                      className={`rounded-full border px-2.5 py-1.5 text-[13px] transition-colors disabled:opacity-40 ${
                        has
                          ? "border-white bg-white text-black hover:bg-neutral-200"
                          : "border-panel-border text-neutral-300 hover:border-white/40 hover:text-white"
                      }`}
                    >
                      {has ? "✓ " : "+ "}
                      {badge.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[12px] text-neutral-500">
                Toggle cosmetic badges on this profile. Role, business and verification badges are set automatically from the account.
              </div>
            </Section>

            <Section title="Label">
              {data.user.accountLabel && !labelEditing ? (
                <div className="flex items-start gap-1.5 text-[13px] text-neutral-300">
                  <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-severity-medium" />
                  <span className="whitespace-pre-wrap break-words">{data.user.accountLabel}</span>
                </div>
              ) : null}

              {labelEditing ? (
                <div className="flex flex-col gap-2">
                  <TextInput
                    value={labelDraft}
                    onChange={(next) => setLabelDraft(next.slice(0, LABEL_MAX))}
                    label="Label text"
                    placeholder="Shown in a tooltip beside this account everywhere on Socially"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {LABEL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setLabelDraft(preset)}
                        className="max-w-full truncate rounded-full border border-panel-border px-2.5 py-1 text-[12px] text-neutral-400 transition-colors hover:border-white/40 hover:text-white"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="text-[12px] text-neutral-500">
                    {labelDraft.trim().length}/{LABEL_MAX}
                  </div>
                </div>
              ) : null}

              <Meta>
                {labelEditing ? (
                  <>
                    <ActionButton
                      tone="primary"
                      disabled={labelBusy || !labelDraft.trim() || labelDraft.trim() === (data.user.accountLabel || "")}
                      onClick={() => saveLabel(labelDraft.trim())}
                    >
                      Save label
                    </ActionButton>
                    <ActionButton
                      disabled={labelBusy}
                      onClick={() => {
                        setLabelEditing(false);
                        setLabelDraft("");
                      }}
                    >
                      Cancel
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton
                    disabled={labelBusy}
                    title="Show a warning sign and tooltip beside this account"
                    onClick={() => {
                      setLabelDraft(data.user.accountLabel || "");
                      setLabelEditing(true);
                    }}
                  >
                    {data.user.accountLabel ? "Edit label" : "Add Label"}
                  </ActionButton>
                )}

                {data.user.accountLabel && !labelEditing ? (
                  <ActionButton
                    disabled={labelBusy}
                    onClick={() =>
                      confirm({
                        title: "Remove label?",
                        description: `The warning sign and tooltip will no longer show beside @${username}.`,
                        confirmLabel: "Remove label",
                        onConfirm: () => saveLabel(""),
                      })
                    }
                  >
                    Remove label
                  </ActionButton>
                ) : null}
              </Meta>
            </Section>

            {data.discord ? <DiscordSection discord={data.discord} /> : null}

            <Section title="Activity">
              <div className="grid grid-cols-4 gap-1.5">
                <Stat label="posts" value={data.stats.postsTotal} />
                <Stat label="deleted" value={data.stats.postsDeleted} />
                <Stat label="replies" value={data.stats.replies} />
                <Stat label="reposts" value={data.stats.reposts} />
                <Stat label="followers" value={data.stats.followers} />
                <Stat label="following" value={data.stats.following} />
                <Stat label="messages" value={data.stats.messagesSent} />
                <Stat label="impressions" value={data.stats.impressions} />
              </div>
            </Section>

            <Section title="Moderation history">
              <div className="grid grid-cols-3 gap-1.5">
                <Stat label="reports filed" value={data.moderation.reportsFiled} />
                <Stat label="reports against" value={data.moderation.reportsAgainst} />
                <Stat label="on their posts" value={data.moderation.reportsAgainstPosts} />
              </div>

              {data.moderation.suspensions.length === 0 ? (
                <div className="text-[13px] text-neutral-500">No suspensions on record.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {data.moderation.suspensions.map((suspension) => (
                    <div key={suspension.id} className="rounded-lg border border-panel-border bg-panel-raised px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-neutral-200">{suspension.kind}</span>
                        {suspension.active ? <Tag tone="high">active</Tag> : <Tag>lifted</Tag>}
                        <span className="ml-auto text-[12px] text-neutral-500">
                          {relativeTime(suspension.createdAt)}
                        </span>
                      </div>
                      {suspension.reason ? (
                        <div className="mt-0.5 text-[13px] text-neutral-400">{suspension.reason}</div>
                      ) : null}
                      <div className="mt-0.5 text-[12px] text-neutral-500">
                        by {suspension.issuedBy || "system"}
                        {suspension.liftedBy ? ` · lifted by ${suspension.liftedBy}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <UserAuditLog username={username} />

            <UserContent username={username} />

            <Section title={`Communities (${data.communities.length})`}>
              <div className="flex flex-col gap-1">
                {data.communities.map((community) => (
                  <div key={community.id} className="flex items-center gap-2 text-[13px]">
                    <span className="truncate text-neutral-300">{community.name}</span>
                    <Tag>{community.role}</Tag>
                    {community.status !== "active" ? <Tag tone="high">{community.status}</Tag> : null}
                    <span className="ml-auto text-neutral-500">{community.postsCount} posts</span>
                    {community.role === "owner" ? (
                      <ActionButton
                        onClick={() =>
                          setTransferCommunity({ id: community.id, name: community.name, slug: community.slug })
                        }
                      >
                        Transfer
                      </ActionButton>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          </>
        ) : null}
      </PanelScroll>

      {transferCommunity && data ? (
        <TransferCommunityDialog
          community={transferCommunity}
          currentOwner={data.user}
          onClose={() => setTransferCommunity(null)}
          onTransferred={() => {
            setTransferCommunity(null);
            query.refetch();
          }}
        />
      ) : null}
    </PanelShell>
  );
}
