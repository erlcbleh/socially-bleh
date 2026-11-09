import { useState } from "react";
import { LuCheck, LuCheckCheck, LuTriangleAlert } from "react-icons/lu";
import type { MessageStatus } from "../../types";

const STATUS_LABEL: Record<MessageStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const daysApart = Math.round((startOfLocalDay(new Date()) - startOfLocalDay(date)) / DAY_MS);

  if (daysApart === 0) return time;
  if (daysApart === 1) return `Yesterday ${time}`;
  if (daysApart > 1 && daysApart < 7) {
    return `${date.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;
  }
  if (date.getFullYear() === new Date().getFullYear()) {
    return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${time}`;
  }
  return `${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} ${time}`;
}

export function MessageMeta({
  createdAt,
  status,
  mine,
  edited,
  moderation,
  moderationReason,
}: {
  createdAt: string;
  status?: MessageStatus;
  mine: boolean;
  edited?: boolean;
  moderation?: "pending" | "clear" | "blocked";
  moderationReason?: string | null;
}) {
  const [showReason, setShowReason] = useState(false);
  const Ticks = status === "sent" ? LuCheck : LuCheckCheck;
  const blocked = mine && moderation === "blocked";
  const reason = moderationReason || "This message wasn't sent because it broke our content rules.";

  return (
    <div
      className={`mt-1 flex items-center gap-1 whitespace-nowrap ${
        mine ? "justify-end text-white/60" : "justify-start text-neutral-500"
      }`}
      title={new Date(createdAt).toLocaleString()}
    >
      {edited && <span className="text-[10px] leading-none">edited</span>}
      <span className="text-[10px] leading-none">{formatTime(createdAt)}</span>
      {blocked && (
        <button
          type="button"
          onClick={() => setShowReason((v) => !v)}
          onMouseEnter={() => setShowReason(true)}
          onMouseLeave={() => setShowReason(false)}
          title={reason}
          aria-label={reason}
          className="relative inline-flex shrink-0 text-amber-300 hover:text-amber-200"
        >
          <LuTriangleAlert className="h-3.5 w-3.5" />
          {showReason && (
            <span className="absolute bottom-full right-0 z-50 mb-1.5 w-56 whitespace-normal rounded-md border border-neutral-200 bg-white p-2 text-left text-xs font-medium text-black shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
              {reason}
            </span>
          )}
        </button>
      )}
      {mine && status && !blocked && (
        <>
          <Ticks
            className={`h-3.5 w-3.5 shrink-0 ${status === "read" ? "text-sky-300" : "text-white/60"}`}
            aria-hidden
          />
          <span className="sr-only">{STATUS_LABEL[status]}</span>
        </>
      )}
    </div>
  );
}
