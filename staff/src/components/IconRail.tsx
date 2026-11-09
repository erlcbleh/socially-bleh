import {
  LuLayoutGrid,
  LuFlag,
  LuUsers,
  LuShield,
  LuBrain,
  LuScale,
  LuInbox,
  LuNotebookPen,
  LuSun,
  LuMoon,
} from "react-icons/lu";
import type { PanelGroup } from "../panels/registry";

export const RAIL_GROUPS: { group: PanelGroup; label: string; Icon: typeof LuLayoutGrid }[] = [
  { group: "Overview", label: "Overview", Icon: LuLayoutGrid },
  { group: "Moderation", label: "Moderation", Icon: LuFlag },
  { group: "Applications", label: "Applications", Icon: LuInbox },
  { group: "People", label: "People", Icon: LuUsers },
  { group: "Security", label: "Security", Icon: LuShield },
  { group: "AI", label: "AI moderation", Icon: LuBrain },
  { group: "Governance", label: "Governance", Icon: LuScale },
  { group: "Workspace", label: "Workspace", Icon: LuNotebookPen },
];

export function IconRail({
  available,
  active,
  onSelect,
  dimmed,
  onToggleDimmed,
}: {
  available: Set<PanelGroup>;
  active: PanelGroup | null;
  onSelect: (group: PanelGroup) => void;
  dimmed: boolean;
  onToggleDimmed: () => void;
}) {
  const groups = RAIL_GROUPS.filter((entry) => available.has(entry.group));

  return (
    <nav
      aria-label="Panel groups"
      className="flex w-14 shrink-0 flex-col items-center gap-1 rounded-squircle border border-panel-border bg-panel-raised py-3"
    >
      <a
        href="/"
        title="Socially Staff"
        className="mb-2 flex h-8 w-8 items-center justify-center opacity-90 transition-opacity hover:opacity-100"
      >
        <img src="/logo-white.svg" alt="Socially" className="h-6 w-6" />
      </a>

      {groups.map(({ group, label, Icon }) => {
        const isActive = active === group;
        return (
          <button
            key={group}
            type="button"
            onClick={() => onSelect(group)}
            title={label}
            aria-label={label}
            aria-current={isActive ? "true" : undefined}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              isActive
                ? "border-white/40 bg-white/10 text-white"
                : "border-transparent text-neutral-500 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}

      <button
        type="button"
        onClick={onToggleDimmed}
        title={dimmed ? "Raise contrast" : "Dim the interface"}
        aria-label={dimmed ? "Raise contrast" : "Dim the interface"}
        aria-pressed={dimmed}
        className="mt-auto flex h-9 w-9 items-center justify-center rounded-lg border border-panel-border text-neutral-500 transition-colors hover:border-white/40 hover:text-white"
      >
        {dimmed ? <LuMoon className="h-[18px] w-[18px]" /> : <LuSun className="h-[18px] w-[18px]" />}
      </button>
    </nav>
  );
}
