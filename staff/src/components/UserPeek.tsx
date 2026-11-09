import { useQuery } from "@socially/shared/queryStore";
import { Modal } from "@socially/shared/components/Modal";
import { CopyButton } from "@socially/shared/components/CopyButton";
import { Avatar } from "@socially/shared/components/Avatar";
import { api } from "../lib/api";
import { closeUserPeek, useUserPeek } from "../lib/userPeek";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { absoluteTime, relativeTime } from "../lib/time";
import type { UserDossierResponse } from "../types";

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-neutral-400">{label}</div>
        <div className="truncate font-mono text-[13px] text-neutral-100">{value || "-"}</div>
      </div>
      {value ? <CopyButton value={value} label={label} withLabel /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2.5">
      <div className="text-lg font-medium tabular-nums leading-none text-white">{value}</div>
      <div className="mt-1 text-[12px] text-neutral-400">{label}</div>
    </div>
  );
}

export function UserPeek() {
  const username = useUserPeek();

  const query = useQuery<UserDossierResponse>({
    queryKey: ["staff", "peek", username],
    queryFn: () => api.get<UserDossierResponse>(`/users/${encodeURIComponent(username || "")}/details`),
    enabled: Boolean(username),
  });

  if (!username) return null;

  const data = query.data;
  const user = data?.user;
  const suspended = data?.account.suspendedUntil || (user && user.status !== "active");

  return (
    <Modal open onClose={closeUserPeek} size="sm">
      <div className="flex flex-col gap-4">
        {query.isLoading && !data ? (
          <p className="py-10 text-center text-sm text-neutral-400">Loading @{username}…</p>
        ) : null}

        {query.error ? (
          <div className="rounded-xl border border-severity-high/40 bg-severity-high/10 px-3 py-2.5 text-sm text-severity-high">
            {query.error.message}
          </div>
        ) : null}

        {user ? (
          <>
            <div className="flex items-center gap-3">
              <div className="rounded-full ring-1 ring-white/15">
                <Avatar user={user} size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-medium leading-tight text-white">
                  {user.displayName}
                </div>
                <div className="truncate font-mono text-[13px] text-neutral-400">@{user.username}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[11px] text-neutral-200">
                  {user.role}
                </span>
                {suspended ? (
                  <span className="rounded-full border border-severity-high/50 bg-severity-high/10 px-2.5 py-1 text-[11px] text-severity-high">
                    {user.status}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="posts" value={data.stats.postsTotal} />
              <Stat label="followers" value={data.stats.followers} />
              <Stat label="reports" value={data.moderation.reportsAgainst} />
            </div>

            <div className="flex flex-col gap-2">
              <CopyRow label="Username" value={user.username} />
              <CopyRow label="User ID" value={user.id} />
              {data.account.discordId ? (
                <CopyRow label="Discord ID" value={data.account.discordId} />
              ) : null}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-400">
              {data.account.createdAt ? (
                <span title={absoluteTime(data.account.createdAt)}>
                  Joined {relativeTime(data.account.createdAt)}
                </span>
              ) : null}
              {data.account.lastActiveAt ? (
                <span title={absoluteTime(data.account.lastActiveAt)}>
                  Active {relativeTime(data.account.lastActiveAt)}
                </span>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/[0.09] pt-3.5">
              <button
                type="button"
                onClick={closeUserPeek}
                className="rounded-full border border-white/15 px-3.5 py-2 text-[13px] text-neutral-200 transition-colors hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelection("user", user.username);
                  openPanel({ panelId: "users.dossier" });
                  closeUserPeek();
                }}
                className="rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-neutral-200"
              >
                Open dossier
              </button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
