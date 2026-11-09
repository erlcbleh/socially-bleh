import { useState } from "react";
import { useQuery } from "@socially/shared/queryStore";
import { useConfirm } from "@socially/shared/components/ConfirmDialog";
import { api } from "../lib/api";
import { relativeTime } from "../lib/time";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import {
  ActionButton,
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
import type { BusinessApplicationRow } from "../types";

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export function BusinessApplications() {
  const [status, setStatus] = useState<Status>("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm(busy);

  const query = useQuery<{ applications: BusinessApplicationRow[] }>({
    queryKey: ["staff", "businessApplications", status],
    queryFn: () =>
      api.get<{ applications: BusinessApplicationRow[] }>(`/business-applications?status=${status}`),
  });

  const applications = query.data?.applications ?? [];

  const decide = (id: string, action: "approve" | "reject") => {
    setError(null);
    setBusy(true);
    api
      .post(`/business-applications/${id}/action`, { action, note: note.trim() })
      .then(() => {
        setNote("");
        setExpanded(null);
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const submitRevert = (id: string) => {
    setError(null);
    setBusy(true);
    api
      .post(`/business-applications/${id}/revert`, {})
      .then(() => {
        setExpanded(null);
        return query.refetch();
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  };

  const revert = (application: BusinessApplicationRow) => {
    if (application.status === "approved") {
      confirm({
        title: `Undo approval of ${application.name}`,
        description:
          "This deletes the created business account and reopens the application. Any posts or collaborators on that account are removed.",
        confirmLabel: "Undo approval",
        onConfirm: () => submitRevert(application.id),
      });
      return;
    }
    submitRevert(application.id);
  };

  const toggle = (id: string) => {
    setExpanded((current) => (current === id ? null : id));
    setNote("");
    setError(null);
  };

  return (
    <PanelShell>
      {confirmDialog}
      <PanelToolbar>
        <Segmented value={status} options={STATUSES} onChange={setStatus} />
        <span className="ml-auto text-[13px] text-neutral-500">{applications.length}</span>
      </PanelToolbar>

      {error ? (
        <div className="border-b border-severity-high/30 bg-severity-high/10 px-3.5 py-2 text-[13px] text-severity-high">
          {error}
        </div>
      ) : null}

      <PanelScroll>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={applications.length === 0}
          emptyLabel="No business applications in this queue."
        />

        {applications.map((application) => {
          const isOpen = expanded === application.id;
          return (
            <div key={application.id}>
              <Row onClick={() => toggle(application.id)} selected={isOpen}>
                <div className="flex items-center gap-2">
                  {application.logoUrl ? (
                    <img
                      src={application.logoUrl}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <span className="truncate text-sm font-medium text-neutral-200">{application.name}</span>
                  <Tag tone="low">@{application.applicant.username}</Tag>
                  {application.discord?.guildId ? (
                    <Tag tone={application.discord.memberCount >= 500 ? "low" : "high"}>
                      {application.discord.memberCount.toLocaleString()} members
                    </Tag>
                  ) : (
                    <Tag tone="high">no server</Tag>
                  )}
                  <span className="ml-auto shrink-0 text-[13px] text-neutral-500">
                    {relativeTime(application.createdAt)}
                  </span>
                </div>
              </Row>

              {isOpen ? (
                <div className="flex flex-col gap-2 border-b border-white/[0.08] bg-panel-raised/40 px-3.5 py-2.5">
                  {application.bannerUrl ? (
                    <img
                      src={application.bannerUrl}
                      alt=""
                      className="h-24 w-full rounded-lg border border-panel-border object-cover"
                    />
                  ) : null}

                  {application.bio ? (
                    <div>
                      <div className="text-[12px] font-semibold text-neutral-500">Bio</div>
                      <p className="whitespace-pre-wrap break-words text-[13px] text-neutral-300">
                        {application.bio}
                      </p>
                    </div>
                  ) : null}

                  {application.discord?.guildId ? (
                    <div>
                      <div className="text-[12px] font-semibold text-neutral-500">Discord server</div>
                      <div className="flex items-center gap-2">
                        {application.discord.guildIconUrl ? (
                          <img
                            src={application.discord.guildIconUrl}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-lg object-cover"
                          />
                        ) : null}
                        <span className="truncate text-[13px] text-neutral-300">
                          {application.discord.guildName || application.discord.guildId}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] text-neutral-400">
                        {application.discord.memberCount.toLocaleString()} members &middot;{" "}
                        {application.discord.presenceCount.toLocaleString()} online
                        {application.discord.checkedAt
                          ? ` · verified ${relativeTime(application.discord.checkedAt)}`
                          : ""}
                      </div>
                      <a
                        href={application.discord.inviteUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[13px] text-neutral-300 underline decoration-white/25 underline-offset-2 hover:decoration-white"
                      >
                        {application.discord.inviteUrl}
                      </a>
                    </div>
                  ) : null}

                  <div>
                    <div className="text-[12px] font-semibold text-neutral-500">Applicant</div>
                    <button
                      onClick={() => {
                        setSelection("user", application.applicant.username);
                        openPanel({ panelId: "users.dossier" });
                      }}
                      className="text-[13px] text-neutral-300 underline decoration-white/25 underline-offset-2 hover:decoration-white"
                    >
                      @{application.applicant.username}
                    </button>
                  </div>

                  {application.staffNote ? (
                    <div>
                      <div className="text-[12px] font-semibold text-neutral-500">Staff note</div>
                      <p className="whitespace-pre-wrap break-words text-[13px] text-neutral-300">
                        {application.staffNote}
                      </p>
                    </div>
                  ) : null}

                  {status === "pending" ? (
                    <>
                      <TextInput value={note} onChange={setNote} placeholder="Note (optional)" />
                      <Meta>
                        <ActionButton
                          onClick={() => decide(application.id, "approve")}
                          tone="primary"
                          disabled={busy}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          onClick={() => decide(application.id, "reject")}
                          tone="danger"
                          disabled={busy}
                        >
                          Reject
                        </ActionButton>
                      </Meta>
                    </>
                  ) : (
                    <Meta>
                      <ActionButton onClick={() => revert(application)} disabled={busy}>
                        {application.status === "approved" ? "Undo approval" : "Undo rejection"}
                      </ActionButton>
                    </Meta>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelScroll>
    </PanelShell>
  );
}
