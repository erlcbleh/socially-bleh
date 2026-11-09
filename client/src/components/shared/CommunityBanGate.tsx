import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useCommunity } from "../../lib/communityContext";

function formatTimeLeft(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function CommunityBanGate() {
  const { community } = useCommunity();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!community || community.myStatus !== "banned") return null;

  const until = community.myBannedUntil ? new Date(community.myBannedUntil).getTime() : null;
  const isTemporary = until !== null && until > now;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-gradient-to-t from-red-600/70 via-red-800/30 to-transparent dark:from-red-900 dark:via-red-950/80 dark:to-black/70">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-neutral-950">
        <h1 className="text-3xl font-medium text-black dark:text-white">Banned</h1>
        <p className="mt-2 text-sm text-neutral-500">
          You've been {isTemporary ? "temporarily" : "permanently"} banned from {community.name}.
        </p>

        <div className="mt-6">
          <p className="text-xs font-medium tracking-wide text-neutral-400">Reason</p>
          <p className="mt-1 text-md font-medium text-neutral-700 dark:text-neutral-300">
            {community.myBannedReason || "No reason was provided."}
          </p>
        </div>

        {isTemporary && until !== null && (
          <div className="mt-4">
            <p className="text-xs font-medium tracking-wide text-neutral-400">Time left</p>
            <p className="mt-1 text-md font-medium tabular-nums text-neutral-900 dark:text-white">
              {formatTimeLeft(until - now)}
            </p>
          </div>
        )}

        <button
          onClick={() => navigate("/communities")}
          className="mt-8 w-full rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Back to your communities
        </button>
      </div>
    </div>,
    document.body
  );
}
