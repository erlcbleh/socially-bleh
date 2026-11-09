import { useEffect, useState } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { useQuery } from "@socially/shared/queryStore";
import { useConfirm } from "@socially/shared/components/ConfirmDialog";
import { api } from "../lib/api";
import { useAuth } from "../lib/authContext";
import { absoluteTime, relativeTime } from "../lib/time";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { profileUrl } from "../lib/links";
import {
  ActionButton,
  Field,
  Meta,
  PanelScroll,
  PanelShell,
  PanelToolbar,
  QueryState,
  Row,
  Segmented,
  Tag,
  TextInput,
} from "../components/panelKit";
import { RANK_LEVEL } from "../types";
import type { BusinessAccountRow, DeletedBusinessRow } from "../types";

const VIEWS = ["active", "removed"] as const;
type View = (typeof VIEWS)[number];

function openProfile(username: string) {
  const url = profileUrl(username);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function OwnerLink({ username }: { username: string }) {
  return (
    <button
      onClick={() => {
        setSelection("user", username);
        openPanel({ panelId: "users.dossier" });
      }}
      className="text-[13px] text-neutral-300 underline decoration-white/25 underline-offset-2 hover:decoration-white"
    >
      @{username}
    </button>
  );
}

const LABEL_MAX = 280;

const LABEL_PRESETS = [
  "This is a fictional account, if you are in distress or need emergency services call 911 or your local emergency number.",
  "This is a roleplay account and is not affiliated with any real law enforcement or government agency.",
  "Parody account. Not affiliated with the organisation it depicts.",
];

function ActiveList({ search, canDelete }: { search: string; canDelete: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const [labelEditing, setLabelEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelBusy, setLabelBusy] = useState(false);

  const query = useQuery<{ businesses: BusinessAccountRow[]; canDelete: boolean }>({
    queryKey: ["staff", "businesses", search],
    queryFn: () =>
      api.get<{ businesses: BusinessAccountRow[]; canDelete: boolean }>(
        `/businesses?q=${encodeURIComponent(search)}`
      ),
  });

  const { confirm, dialog } = useConfirm(busy || labelBusy);
  const businesses = query.data?.businesses ?? [];

  const remove = (business: BusinessAccountRow) => {
    setError(null);
    setBusy(true);
    api
      .delete(`/businesses/${business.id}`, { reason: reason.trim() })
      .then(() => {
        setRemoved(business.username);
        setReason("");
        setExpanded(null);
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const saveLabel = (business: BusinessAccountRow, next: string) => {
    setError(null);
    setLabelBusy(true);
    api
      .put(`/businesses/${business.id}/label`, { label: next })
      .then(() => {
        setLabelEditing(false);
        setLabelDraft("");
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLabelBusy(false));
  };

  return (
    <>
      {dialog}
      {error ? (
        <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">
          {error}
        </div>
      ) : null}
      {removed ? (
        <div className="border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2 text-[13px] text-neutral-300">
          Removed @{removed}. The username is free to claim again.
        </div>
      ) : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={businesses.length === 0}
          emptyLabel="No business accounts found."
        />

        {businesses.map((business) => {
          const isOpen = expanded === business.id;
          return (
            <div key={business.id}>
              <Row
                onClick={() => {
                  setExpanded((current) => (current === business.id ? null : business.id));
                  setReason("");
                  setError(null);
                  setLabelEditing(false);
                  setLabelDraft("");
                }}
                selected={isOpen}
              >
                <div className="flex items-center gap-2">
                  {business.avatarUrl ? (
                    <img src={business.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-lg object-cover" />
                  ) : null}
                  <span className="truncate text-sm font-medium text-neutral-200">{business.displayName}</span>
                  {business.accountLabel ? (
                    <LuTriangleAlert
                      aria-label={business.accountLabel}
                      className="h-4 w-4 shrink-0 text-severity-medium"
                    />
                  ) : null}
                  <Tag tone="low">@{business.username}</Tag>
                  <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                    {relativeTime(business.createdAt)}
                  </span>
                </div>
              </Row>

              {isOpen ? (
                <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                  {business.bio ? (
                    <Field label="Bio">
                      <span className="whitespace-pre-wrap break-words">{business.bio}</span>
                    </Field>
                  ) : null}

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Posts">{business.postsCount}</Field>
                    <Field label="Followers">{business.followersCount}</Field>
                    <Field label="Collaborators">{business.collaboratorCount}</Field>
                  </div>

                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Owner</div>
                    {business.owner ? (
                      <OwnerLink username={business.owner.username} />
                    ) : (
                      <span className="text-[13px] text-neutral-500">No owner on record</span>
                    )}
                  </div>

                  <Field label="Created">{absoluteTime(business.createdAt)}</Field>

                  {business.accountLabel && !labelEditing ? (
                    <Field label="Label">
                      <span className="flex items-start gap-1.5">
                        <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-severity-medium" />
                        <span className="whitespace-pre-wrap break-words">{business.accountLabel}</span>
                      </span>
                    </Field>
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

                  {canDelete ? (
                    <TextInput
                      value={reason}
                      onChange={setReason}
                      placeholder="Reason (required, kept on the snapshot)"
                    />
                  ) : (
                    <p className="text-[12px] text-neutral-500">
                      Only admins and above can delete a business account.
                    </p>
                  )}

                  <Meta>
                    <ActionButton
                      onClick={() => openProfile(business.username)}
                      title={`Open @${business.username} on socially`}
                    >
                      Open page
                    </ActionButton>

                    {labelEditing ? (
                      <>
                        <ActionButton
                          tone="primary"
                          disabled={labelBusy || !labelDraft.trim() || labelDraft.trim() === business.accountLabel}
                          onClick={() => saveLabel(business, labelDraft.trim())}
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
                          setLabelDraft(business.accountLabel);
                          setLabelEditing(true);
                        }}
                      >
                        {business.accountLabel ? "Edit label" : "Add Label"}
                      </ActionButton>
                    )}

                    {business.accountLabel && !labelEditing ? (
                      <ActionButton
                        disabled={labelBusy}
                        onClick={() =>
                          confirm({
                            title: "Remove label?",
                            description: `The warning sign and tooltip will no longer show beside @${business.username}.`,
                            confirmLabel: "Remove label",
                            onConfirm: () => saveLabel(business, ""),
                          })
                        }
                      >
                        Remove label
                      </ActionButton>
                    ) : null}

                    {canDelete ? (
                      <ActionButton
                        tone="danger"
                        disabled={busy || !reason.trim()}
                        title={reason.trim() ? undefined : "Enter a reason first"}
                        onClick={() =>
                          confirm({
                            title: `Delete ${business.displayName}?`,
                            description: `Permanently removes @${business.username} and everything it posted, and frees the username. A snapshot is kept in Removed. This cannot be undone.`,
                            confirmLabel: "Delete business",
                            tone: "danger",
                            onConfirm: () => remove(business),
                          })
                        }
                      >
                        Delete business
                      </ActionButton>
                    ) : null}
                  </Meta>
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelScroll>
    </>
  );
}

function RemovedList({ search }: { search: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery<{ businesses: DeletedBusinessRow[] }>({
    queryKey: ["staff", "businessesDeleted", search],
    queryFn: () =>
      api.get<{ businesses: DeletedBusinessRow[] }>(`/businesses/deleted?q=${encodeURIComponent(search)}`),
  });

  const businesses = query.data?.businesses ?? [];

  return (
    <PanelScroll>
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={businesses.length === 0}
        emptyLabel="No removed business accounts."
      />

      {businesses.map((snapshot) => {
        const isOpen = expanded === snapshot.id;
        return (
          <div key={snapshot.id}>
            <Row
              onClick={() => setExpanded((current) => (current === snapshot.id ? null : snapshot.id))}
              selected={isOpen}
            >
              <div className="flex items-center gap-2">
                {snapshot.avatarUrl ? (
                  <img src={snapshot.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-lg object-cover" />
                ) : null}
                <span className="truncate text-sm font-medium text-neutral-200">{snapshot.displayName}</span>
                <Tag tone="high">@{snapshot.username}</Tag>
                <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                  {relativeTime(snapshot.deletedAt)}
                </span>
              </div>
            </Row>

            {isOpen ? (
              <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                {snapshot.bio ? (
                  <Field label="Bio">
                    <span className="whitespace-pre-wrap break-words">{snapshot.bio}</span>
                  </Field>
                ) : null}

                <Field label="Reason">
                  <span className="whitespace-pre-wrap break-words">{snapshot.reason}</span>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Removed by">
                    {snapshot.deletedByUsername ? `@${snapshot.deletedByUsername}` : "-"}
                  </Field>
                  <Field label="Removed">{absoluteTime(snapshot.deletedAt)}</Field>
                  <Field label="Owner">
                    {snapshot.ownerUsername ? <OwnerLink username={snapshot.ownerUsername} /> : "-"}
                  </Field>
                  <Field label="Created">
                    {snapshot.accountCreatedAt ? absoluteTime(snapshot.accountCreatedAt) : "-"}
                  </Field>
                  <Field label="Posts at removal">{snapshot.postsCount}</Field>
                  <Field label="Followers at removal">{snapshot.followersCount}</Field>
                </div>

                {snapshot.discord.guildId ? (
                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Discord server</div>
                    <div className="text-[13px] text-neutral-300">
                      {snapshot.discord.guildName || snapshot.discord.guildId} &middot;{" "}
                      {snapshot.discord.memberCount.toLocaleString()} members
                    </div>
                    {snapshot.discord.inviteUrl ? (
                      <a
                        href={snapshot.discord.inviteUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[13px] text-neutral-300 underline decoration-white/25 underline-offset-2 hover:decoration-white"
                      >
                        {snapshot.discord.inviteUrl}
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {snapshot.collaborators.length ? (
                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Collaborators</div>
                    <div className="flex flex-wrap gap-1.5">
                      {snapshot.collaborators.map((collaborator) => (
                        <OwnerLink key={collaborator.id} username={collaborator.username} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </PanelScroll>
  );
}

export function BusinessAccounts() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const canDelete = RANK_LEVEL[user?.role ?? "user"] >= RANK_LEVEL.admin;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <PanelShell>
      <PanelToolbar>
        <Segmented value={view} options={VIEWS} onChange={setView} />
        <div className="ml-auto w-44">
          <TextInput value={query} onChange={setQuery} placeholder="Search name or @username" />
        </div>
      </PanelToolbar>

      {view === "active" ? (
        <ActiveList search={search} canDelete={canDelete} />
      ) : (
        <RemovedList search={search} />
      )}
    </PanelShell>
  );
}
