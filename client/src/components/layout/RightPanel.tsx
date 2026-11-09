import { Link } from "react-router-dom";
import { FaDiscord } from "react-icons/fa6";
import { useAuth } from "../../lib/authContext";
import { DISCORD_INVITE_URL } from "../../lib/links";
import { TrendingWidget } from "./TrendingWidget";

export function RightPanel() {
  const { user } = useAuth();
  const isBanned = user?.status === "banned";
  const isSuspended =
    user?.status === "suspended" && !!user.suspendedUntil && new Date(user.suspendedUntil).getTime() > Date.now();
  const isRestricted = isBanned || isSuspended;

  if (isRestricted) return null;

  return (
    <div className="sticky top-16 mt-20 space-y-4 p-4">
      <TrendingWidget />
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noreferrer"
        className="card-surface group block rounded-xl p-3 hover:[--card-ring:#5865F2]"
      >
        <div className="flex items-center gap-2">
          <FaDiscord className="h-5 w-5 shrink-0 text-[#5865F2]" />
          <h2 className="text-base font-medium">Join our Discord</h2>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Announcements, support and early access to what we're building next.
        </p>
      </a>

      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        <Link to="/terms" className="hover:underline transition-all">
          Terms Of Service
        </Link>
        <span className="text-neutral-400 dark:text-neutral-600">|</span>
        <Link to="/privacy" className="hover:underline transition-all">
          Privacy Policy
        </Link>
        <span className="text-neutral-400 dark:text-neutral-600">|</span>
        <span>© 2026 socially.lol</span>
      </div>
    </div>
  );
}
