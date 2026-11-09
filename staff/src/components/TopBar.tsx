import { useState } from "react";
import { useAuth } from "../lib/authContext";
import { useStaffConnection, useStaffPresence, publishFocus } from "../lib/realtime";
import { setSelection } from "../lib/selectionBus";
import { openPanel } from "../lib/panelBus";
import { LuSun, LuMoon } from "react-icons/lu";
import { LayoutBar } from "./LayoutBar";
import { UserPicker } from "./UserPicker";
import { useUiMode } from "../lib/uiMode";
import type { StaffContext, UserLookupResult } from "../types";

function ConnectionDot() {
  const connection = useStaffConnection();
  const dot =
    connection === "online" ? "bg-white" : connection === "connecting" ? "bg-white/40" : "bg-severity-high";

  return (
    <span className="flex items-center gap-1.5" title={`Realtime ${connection}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-[11px] font-semibold text-neutral-500">{connection}</span>
    </span>
  );
}

function PresenceStrip() {
  const { staff } = useStaffPresence();
  if (staff.length === 0) return null;

  return (
    <div className="flex items-center gap-1" aria-label={`${staff.length} staff online`}>
      {staff.slice(0, 6).map((entry) => (
        <span
          key={entry.userId}
          title={`@${entry.username}${entry.focus ? `, ${entry.focus.channel}` : ""}`}
          className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-panel-raised text-[11px] text-neutral-400 ring-1 ring-panel-border"
        >
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            entry.username.slice(0, 2)
          )}
        </span>
      ))}
      {staff.length > 6 ? (
        <span className="font-mono text-[12px] text-neutral-500">+{staff.length - 6}</span>
      ) : null}
    </div>
  );
}

function UserSearch() {
  const [picked, setPicked] = useState<UserLookupResult | null>(null);

  const jumpTo = (user: UserLookupResult | null) => {
    setPicked(null);
    if (!user) return;
    setSelection("user", user.username);
    publishFocus({ channel: "user", id: user.username });
    openPanel({ panelId: "users.dossier" });
  };

  return (
    <UserPicker
      value={picked}
      onChange={jumpTo}
      variant="search"
      placeholder="Find a user…"
      label="Find a user"
      className="w-56"
    />
  );
}

export function TopBar({
  staff,
  onOpenSettings,
  dimmed,
  onToggleDimmed,
}: {
  staff: StaffContext;
  onOpenSettings: () => void;
  dimmed?: boolean;
  onToggleDimmed?: () => void;
}) {
  const { user, logout } = useAuth();
  const mode = useUiMode();
  if (!user) return null;

  const communityCount = Object.keys(staff.communityRoles).length;

  return (
    <header className="flex shrink-0 items-center gap-3 px-1 py-2.5">
      <img src="/wordmark-white.svg" alt="Socially" className="h-3.5 w-auto" />
      <span className="-ml-1 text-[12px] font-light text-neutral-500">Staff</span>

      <span className="rounded-full border border-panel-border px-2.5 py-[1px] text-[11px] font-semibold text-neutral-400">
        {staff.isGlobalStaff ? staff.role : `community ×${communityCount}`}
      </span>

      <ConnectionDot />
      {mode === "advanced" ? <PresenceStrip /> : null}

      <div className="ml-auto flex items-center gap-2">
        <UserSearch />
        {mode === "advanced" ? <LayoutBar staff={staff} /> : null}
        {onToggleDimmed ? (
          <button
            type="button"
            onClick={onToggleDimmed}
            title={dimmed ? "Brighten" : "Dim"}
            aria-label={dimmed ? "Brighten" : "Dim"}
            className="rounded-full border border-transparent p-2 text-neutral-500 transition-colors hover:border-panel-border hover:text-white"
          >
            {dimmed ? <LuSun className="h-4 w-4" /> : <LuMoon className="h-4 w-4" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
          className="rounded-full border border-transparent px-2.5 py-1.5 text-[13px] text-neutral-500 transition-colors hover:border-panel-border hover:text-white"
        >
          Settings
        </button>
        <span className="font-mono text-[13px] text-neutral-500">@{user.username}</span>
        <button
          onClick={logout}
          className="rounded-full border border-transparent px-3 py-1.5 text-[13px] text-neutral-500 transition-colors hover:border-panel-border hover:text-white"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
