import { profilePath } from "../../lib/communityPath";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import { Modal } from "../../components/shared/Modal";
import { Avatar } from "../../components/shared/Avatar";
import type { AuditLogEntry, User } from "../../types";

function actionLabel(action: string) {
  return action.replaceAll("_", " ");
}

function UserChip({ user }: { user: User }) {
  return (
    <Link
      to={profilePath(user.username)}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 align-middle font-medium text-black hover:underline dark:text-white"
    >
      <Avatar user={user} size={5} />
      @{user.username}
    </Link>
  );
}

function TargetDisplay({ entry }: { entry: AuditLogEntry }) {
  if (entry.targetUser) return <UserChip user={entry.targetUser} />;
  return <>{entry.targetLabel}</>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function metaLabel(key: string) {
  const spaced = key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function metaValue(value: unknown): string {
  if (typeof value === "string" && ISO_DATE.test(value)) return new Date(value).toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function CommunityAuditLog() {
  const slug = useCommunitySlug();
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["community", slug, "audit-log"],
    queryFn: () => api.get<{ entries: AuditLogEntry[] }>(`/communities/${slug}/audit-log`),
  });

  return (
    <div className="space-y-2">
      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
      {!isLoading && data?.entries.length === 0 && <p className="text-center text-neutral-400">No actions logged yet.</p>}

      <div className="space-y-2">
        {data?.entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setSelected(entry)}
            className="w-full rounded-xl border border-neutral-200 p-3 text-left text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                {entry.staff ? <UserChip user={entry.staff} /> : "Unknown staff"}
                <span className="capitalize">{actionLabel(entry.action)}</span> ·{" "}
                <TargetDisplay entry={entry} />
              </span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Audit log entry">
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Staff</span>
              {selected.staff ? <UserChip user={selected.staff} /> : <span>Unknown staff</span>}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Action</span>
              <span className="capitalize">{actionLabel(selected.action)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Target type</span>
              <span className="capitalize">{selected.targetType.replaceAll("_", " ")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Target</span>
              <span className="text-right">
                <TargetDisplay entry={selected} />
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">Date</span>
              <span>{new Date(selected.createdAt).toLocaleString()}</span>
            </div>
            {typeof selected.meta?.content === "string" && (
              <div>
                <span className="text-neutral-500">Post content</span>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
                  {selected.meta?.content || <span className="text-neutral-400">(empty post)</span>}
                </p>
              </div>
            )}
            {selected.meta && Object.entries(selected.meta).filter(([key]) => key !== "content").length > 0 && (
              <div className="space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                {Object.entries(selected.meta)
                  .filter(([key]) => key !== "content")
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <span className="text-neutral-500">{metaLabel(key)}</span>
                      <span className="text-right">{metaValue(value)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
