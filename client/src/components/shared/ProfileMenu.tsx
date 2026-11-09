import { useState } from "react";
import { LuEllipsis } from "react-icons/lu";
import { useMuteMutation, useBlockMutation, useReportUser } from "../../hooks/useProfile";
import { ReportDialog } from "../post/ReportDialog";
import type { User } from "../../types";

export function ProfileMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const muteMutation = useMuteMutation(user.username);
  const blockMutation = useBlockMutation(user.username);
  const reportUser = useReportUser();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-neutral-300 p-2 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        aria-label="More options"
      >
        <LuEllipsis className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
            <button
              onClick={() => {
                muteMutation.mutate(!!user.isMutedByMe);
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {user.isMutedByMe ? `Unmute @${user.username}` : `Mute @${user.username}`}
            </button>
            <button
              onClick={() => {
                blockMutation.mutate(!!user.isBlockedByMe);
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-neutral-50 dark:text-red-400 dark:hover:bg-neutral-800"
            >
              {user.isBlockedByMe ? `Unblock @${user.username}` : `Block @${user.username}`}
            </button>
            <button
              onClick={() => {
                setReportOpen(true);
                setOpen(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-neutral-50 dark:text-red-400 dark:hover:bg-neutral-800"
            >
              Report @{user.username}
            </button>
          </div>
        </>
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Report @${user.username}`}
        isSubmitting={reportUser.isPending}
        onSubmit={(reason, details) => {
          reportUser.mutate(
            { username: user.username, reason, details },
            { onSuccess: () => setReportOpen(false) }
          );
        }}
      />
    </div>
  );
}
