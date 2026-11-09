import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "../../lib/queryStore";
import { useAuth } from "../../lib/authContext";
import { api } from "../../lib/api";
import { disableGuestMode } from "../../lib/guestMode";

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

export function SuspensionGate() {
  const { user, refetch } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const until = user.suspendedUntil ? new Date(user.suspendedUntil).getTime() : null;
  const isBanned = user.status === "banned";
  const isSuspended = user.status === "suspended" && until !== null && until > now;

  if (!isBanned && !isSuspended) return null;

  const logout = async () => {
    await api.post("/auth/logout");
    disableGuestMode();
    queryClient.clear();
    refetch();
    navigate("/");
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md ${
        isBanned
          ? "bg-gradient-to-t from-red-600/70 via-red-800/30 to-transparent dark:from-red-900 dark:via-red-950/80 dark:to-black/70"
          : "bg-gradient-to-t from-amber-600/70 via-amber-800/30 to-transparent dark:from-amber-900/90 dark:via-amber-950/80 dark:to-black/70"
      }`}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-neutral-950"
      >
        <h1 className="text-3xl font-medium text-black dark:text-white">{isBanned ? "Banned" : "Suspended"}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {isBanned
            ? "Your account has been permanently banned."
            : "Your account is temporarily suspended. You can't post, reply, or view content until this ends."}
        </p>

        <div className="mt-6">
          <p className="text-xs font-medium tracking-wide text-neutral-400">Reason</p>
          <p className="mt-1 text-md font-medium text-neutral-700 dark:text-neutral-300">
            {user.suspendReason || "No reason was provided."}
          </p>
        </div>

        {isSuspended && until !== null && (
          <div className="mt-4">
            <p className="text-xs font-medium tracking-wide text-neutral-400">Time left</p>
            <p className="mt-1 text-md font-medium tabular-nums text-neutral-900 dark:text-white">
              {formatTimeLeft(until - now)}
            </p>
          </div>
        )}

        <p className="mt-6 text-xs text-neutral-500">
          Think this was a mistake? Appeal at{" "}
          <a href="mailto:support@socially.lol" className="text-brand hover:underline">
            support@socially.lol
          </a>
          .
        </p>

        <button
          onClick={logout}
          className="mt-4 w-full rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Log out
        </button>
      </div>
    </div>,
    document.body
  );
}
