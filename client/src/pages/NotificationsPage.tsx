import { communityPath, profilePath } from "../lib/communityPath";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "../lib/queryStore";
import { LuBell } from "react-icons/lu";
import { useNotificationsList, useMarkAllRead } from "../hooks/useNotifications";
import { useCommunitySlug } from "../hooks/useCommunitySlug";
import { Avatar } from "../components/shared/Avatar";
import FlickerSpinner from "../components/shared/FlickerSpinner";
import { api } from "../lib/api";
import type { Notification } from "../types";
import { renderWithEmoji } from "../lib/emoji";

const LABELS: Record<Notification["type"], (name: string) => string> = {
  like: (name) => `liked your post`,
  repost: (name) => `reposted your post`,
  comment: (name) => `replied to your post`,
  quote: (name) => `quoted your post`,
  follow: (name) => `started following you`,
  follow_request: (name) => `requested to follow you`,
  follow_accept: (name) => `accepted your follow request`,
  verification_approved: () => `Your verification application was approved`,
  verification_rejected: () => `Your verification application was not approved`,
  professional_approved: () => `Your professional application was approved`,
  professional_rejected: () => `Your professional application was not approved`,
  business_approved: () => `Your business application was approved`,
  business_rejected: () => `Your business application was not approved`,
  community_verification_approved: () => `Your community verification application was approved`,
  community_verification_rejected: () => `Your community verification application was not approved`,
  community_verification_invited: () => `You've reached this community's follower threshold and been invited to be verified`,
  mention: (name) => `mentioned you in a post`,
  poll_ended: () => `Your poll has closed`,
  report_actioned: () => `Your report was reviewed and action was taken`,
  report_dismissed: () => `Your report was reviewed and dismissed`,
  content_flagged: () => `Your post was flagged by our moderation system and is pending staff review`,
  content_flag_dismissed: () => `Your flagged post was reviewed and restored - no action was taken`,
  content_flag_actioned: () => `Your flagged post was reviewed and action was taken`,
};

function FollowRequestActions({ notification }: { notification: Notification }) {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") =>
      api.post(`/users/${notification.actor!.username}/follow-request`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="mt-2 flex gap-2">
      <button
        onClick={() => respond.mutate("accept")}
        disabled={respond.isPending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        Accept
      </button>
      <button
        onClick={() => respond.mutate("decline")}
        disabled={respond.isPending}
        className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-neutral-700"
      >
        Decline
      </button>
    </div>
  );
}

function CommunityVerificationInviteActions() {
  const slug = useCommunitySlug();
  const queryClient = useQueryClient();
  const respond = useMutation({
    mutationFn: (action: "accept" | "decline") => api.post(`/communities/${slug}/verification/invite/respond`, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
    },
  });

  return (
    <div className="mt-2 flex gap-2">
      <button
        onClick={() => respond.mutate("accept")}
        disabled={respond.isPending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        Accept
      </button>
      <button
        onClick={() => respond.mutate("decline")}
        disabled={respond.isPending}
        className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-neutral-700"
      >
        Decline
      </button>
    </div>
  );
}

function notificationTarget(n: Notification, slug: string): string | null {
  const communitySlug = n.community?.slug || slug;
  if (n.post) {
    return communityPath(communitySlug, `@${n.post.author.username}/post/${n.post.shortId || n.post.id}`);
  }
  switch (n.type) {
    case "follow":
    case "follow_request":
    case "follow_accept":
      return n.actor ? profilePath(n.actor.username) : null;
    case "verification_approved":
    case "verification_rejected":
      return "/settings/verification";
    case "professional_approved":
    case "professional_rejected":
    case "business_approved":
    case "business_rejected":
      return "/applications";
    case "community_verification_approved":
    case "community_verification_rejected":
    case "community_verification_invited":
      return communityPath(communitySlug);
    default:
      return n.actor ? profilePath(n.actor.username) : null;
  }
}

export default function NotificationsPage() {
  const slug = useCommunitySlug();
  const navigate = useNavigate();
  const { data, isLoading } = useNotificationsList();
  const markAllRead = useMarkAllRead();

  useEffect(() => {
    markAllRead.mutate();
  }, []);

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <h1 className="text-xl font-medium">Notifications</h1>
      </div>

      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
      {!isLoading && data?.notifications.length === 0 && (
        <p className="p-6 text-center text-neutral-400">Nothing here yet.</p>
      )}

      {data?.notifications.map((n) => {
        const target = notificationTarget(n, slug);
        return (
        <div
          key={n.id}
          onClick={target ? () => navigate(target) : undefined}
          role={target ? "link" : undefined}
          tabIndex={target ? 0 : undefined}
          onKeyDown={
            target
              ? (e) => {
                  if (e.key === "Enter") navigate(target);
                }
              : undefined
          }
          className={`p-4 ${n.read ? "" : "bg-brand/5 dark:bg-brand/10"} ${
            target ? "cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-neutral-900/60" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            {n.actor ? (
              <Link to={profilePath(n.actor.username)} onClick={(e) => e.stopPropagation()}>
                <Avatar user={n.actor} size={9} />
              </Link>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <LuBell className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {n.actor && (
                  <>
                    <Link to={profilePath(n.actor.username)} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
                      {n.actor.displayName}
                    </Link>{" "}
                  </>
                )}
                <span className="text-neutral-600 dark:text-neutral-400">
                  {LABELS[n.type](n.actor?.displayName ?? "")}
                  {n.community && !n.community.isGlobal && (
                    <>
                      {" "}in{" "}
                      <Link
                        to={communityPath(n.community.slug)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-brand hover:underline"
                      >
                        {n.community.name}
                      </Link>
                    </>
                  )}
                </span>
              </p>
              {n.post && (
                <Link
                  to={communityPath(n.community?.slug || slug, `@${n.post.author.username}/post/${n.post.shortId || n.post.id}`)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 block truncate text-sm text-neutral-500 hover:underline"
                >
                  {n.post.content ? renderWithEmoji(n.post.content) : "View post"}
                </Link>
              )}
              {n.note && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-500">Staff note: {n.note}</p>
              )}
              {n.type === "follow_request" && (
                <div onClick={(e) => e.stopPropagation()}>
                  <FollowRequestActions notification={n} />
                </div>
              )}
              {n.type === "community_verification_invited" && (
                <div onClick={(e) => e.stopPropagation()}>
                  <CommunityVerificationInviteActions />
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}
