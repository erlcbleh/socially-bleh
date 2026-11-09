import { profilePath } from "../../lib/communityPath";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "../../lib/queryStore";
import { api } from "../../lib/api";
import { useCommunitySlug } from "../../hooks/useCommunitySlug";
import { Avatar } from "../../components/shared/Avatar";
import FlickerSpinner from "../../components/shared/FlickerSpinner";
import type { CommunityVerificationApplication } from "../../types";
import { useConfirm } from "../../components/shared/ConfirmDialog";

export default function CommunityVerificationQueue() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["community", slug, "verification-applications"],
    queryFn: () => api.get<{ applications: CommunityVerificationApplication[] }>(`/communities/${slug}/verification/applications`),
  });

  const decide = useMutation({
    mutationFn: ({ membershipId, action }: { membershipId: string; action: "approve" | "reject" }) =>
      api.post(`/communities/${slug}/verification/applications/${membershipId}/decide`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community", slug, "verification-applications"] }),
  });

  const { confirm, dialog } = useConfirm(decide.isPending);

  return (
    <div className="space-y-3">
      {dialog}
      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
      {!isLoading && data?.applications.length === 0 && (
        <p className="text-center text-neutral-400">No pending verification applications.</p>
      )}

      {data?.applications.map((app) => (
        <div key={app.membershipId} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Avatar user={app.user} size={9} />
            <div>
              <Link to={profilePath(app.user.username)} className="font-medium hover:underline">
                @{app.user.username}
              </Link>
              <p className="text-xs text-neutral-500">{new Date(app.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          {app.reason && <p className="mt-2 text-sm">{app.reason}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                confirm({
                  title: `Approve @${app.user.username}?`,
                  description: "This grants the verified badge on their profile in this community.",
                  confirmLabel: "Approve",
                  onConfirm: () => decide.mutate({ membershipId: app.membershipId, action: "approve" }),
                })
              }
              disabled={decide.isPending}
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Approve
            </button>
            <button
              onClick={() =>
                confirm({
                  title: `Reject @${app.user.username}?`,
                  description: "Their application is declined and they are notified.",
                  confirmLabel: "Reject",
                  tone: "danger",
                  onConfirm: () => decide.mutate({ membershipId: app.membershipId, action: "reject" }),
                })
              }
              disabled={decide.isPending}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium dark:border-neutral-700 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
