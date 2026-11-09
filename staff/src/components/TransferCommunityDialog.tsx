import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { ActionButton } from "./panelKit";
import type { ReportTargetUser } from "../types";

interface Community {
  id: string;
  name: string;
  slug: string;
}

interface LookupResponse {
  users: ReportTargetUser[];
}

interface TransferResponse {
  ok: boolean;
  newOwner: ReportTargetUser;
  previousOwner: ReportTargetUser | null;
}

type Phase = "form" | "transferring" | "done";

const ANIMATION_MIN_MS = 2000;

function Avatar({
  user,
  fallback,
  size = 56,
}: {
  user?: ReportTargetUser | null;
  fallback?: string;
  size?: number;
}) {
  const initial = (user?.displayName || user?.username || fallback || "?").slice(0, 1).toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-panel-border bg-panel-hover text-lg font-semibold text-neutral-300"
      style={{ width: size, height: size }}
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function TransferAnimation({
  from,
  to,
  status,
}: {
  from: ReportTargetUser | null;
  to: ReportTargetUser;
  status: "moving" | "done";
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <style>{`
        @keyframes tc-shuttle {
          0%   { transform: translateX(-46%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(46%); opacity: 0; }
        }
        @keyframes tc-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      `}</style>

      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex flex-col items-center gap-1.5">
          <div style={{ animation: status === "moving" ? "tc-pulse 1.4s ease-in-out infinite" : "none" }}>
            <Avatar user={from} />
          </div>
          <span className="max-w-[110px] truncate text-[12px] text-neutral-400">
            {from ? `@${from.username}` : "No owner"}
          </span>
        </div>

        <div className="relative mx-2 flex h-14 flex-1 items-center overflow-hidden">
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.35) 50%, transparent 50%)",
              backgroundSize: "8px 1px",
              backgroundRepeat: "repeat-x",
            }}
          />

          {status === "moving"
            ? [0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                  style={{
                    animation: `tc-shuttle 1.4s linear ${i * 0.35}s infinite`,
                    boxShadow: "0 0 10px rgba(255,255,255,0.55)",
                  }}
                />
              ))
            : (
              <span
                className="absolute left-1/2 top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400"
                style={{ boxShadow: "0 0 12px rgba(52,211,153,0.7)" }}
              />
            )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div style={{ animation: status === "moving" ? "tc-pulse 1.4s ease-in-out infinite 0.7s" : "none" }}>
            <Avatar user={to} />
          </div>
          <span className="max-w-[110px] truncate text-[12px] text-neutral-400">
            @{to.username}
          </span>
        </div>
      </div>

      <p className="text-[13px] text-neutral-400">
        {status === "moving" ? "Transferring ownership…" : "Transfer complete."}
      </p>
    </div>
  );
}

export function TransferCommunityDialog({
  community,
  currentOwner,
  onClose,
  onTransferred,
}: {
  community: Community;
  currentOwner: ReportTargetUser | null;
  onClose: () => void;
  onTransferred: (newOwner: ReportTargetUser) => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [username, setUsername] = useState("");
  const [target, setTarget] = useState<ReportTargetUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const resolveTarget = async (needle: string): Promise<ReportTargetUser> => {
    const clean = needle.trim().replace(/^@/, "");
    const data = await api.get<LookupResponse>(`/users?q=${encodeURIComponent(clean)}`);
    const hit = data.users.find((u) => u.username.toLowerCase() === clean.toLowerCase()) || null;
    if (!hit) throw new Error(`No user named @${clean}.`);
    if (currentOwner && hit.username.toLowerCase() === currentOwner.username.toLowerCase()) {
      throw new Error("They already own this community.");
    }
    return hit;
  };

  const runTransfer = async () => {
    setError(null);
    let resolved: ReportTargetUser;
    try {
      resolved = await resolveTarget(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "User lookup failed.");
      return;
    }

    setTarget(resolved);
    setPhase("transferring");

    const started = Date.now();
    try {
      const res = await api.post<TransferResponse>(`/communities/${community.id}/transfer`, {
        toUsername: resolved.username,
      });
      const elapsed = Date.now() - started;
      const wait = Math.max(0, ANIMATION_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));

      setPhase("done");
      closeTimer.current = setTimeout(() => onTransferred(res.newOwner), 600);
    } catch (err) {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, ANIMATION_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      setError(err instanceof Error ? err.message : "Transfer failed.");
      setPhase("form");
    }
  };

  const canClose = phase !== "transferring";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[15vh]"
      onClick={() => canClose && onClose()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-squircle border border-panel-border bg-panel-raised shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-panel-border px-5 py-4">
          <h2 className="text-base font-semibold text-white">Transfer community</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {community.name} <span className="text-neutral-600">· /{community.slug}</span>
          </p>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {phase === "form" ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar user={currentOwner} fallback="?" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] uppercase tracking-label text-neutral-500">Current owner</div>
                  <div className="truncate text-sm text-neutral-200">
                    {currentOwner ? (
                      <>
                        {currentOwner.displayName || currentOwner.username}
                        <span className="text-neutral-500"> @{currentOwner.username}</span>
                      </>
                    ) : (
                      <span className="text-neutral-500">No current owner</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] uppercase tracking-label text-neutral-500">
                  New owner username
                </label>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && username.trim()) runTransfer();
                  }}
                  placeholder="username"
                  className="rounded-lg border border-panel-border bg-transparent px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/40"
                />
                <p className="text-[12px] text-neutral-500">
                  They'll become owner. The current owner will be demoted to staff.
                </p>
              </div>

              {error ? (
                <div className="rounded border border-severity-high/30 bg-severity-high/10 px-3 py-2 text-[13px] text-severity-high">
                  {error}
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <ActionButton onClick={onClose}>Cancel</ActionButton>
                <ActionButton tone="primary" onClick={runTransfer} disabled={!username.trim()}>
                  Transfer
                </ActionButton>
              </div>
            </>
          ) : null}

          {phase !== "form" && target ? (
            <TransferAnimation
              from={currentOwner}
              to={target}
              status={phase === "done" ? "done" : "moving"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
