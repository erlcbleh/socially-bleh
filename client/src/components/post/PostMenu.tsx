import { useState } from "react";
import type { IconType } from "react-icons";
import { LuEllipsis, LuPencil, LuTrash2, LuPin, LuPinOff } from "react-icons/lu";
import { useAuth } from "../../lib/authContext";
import { useCommunity } from "../../lib/communityContext";
import { useDeletePost, useMarkNotInterested, useReportPost, usePinPost, useUnpinPost } from "../../hooks/usePosts";
import { useFollowMutation, useMuteMutation, useBlockMutation } from "../../hooks/useProfile";
import { hasPermission } from "../../config/roles.config";
import { ReportDialog } from "./ReportDialog";
import { EditPostDialog } from "./EditPostDialog";
import { Modal } from "../shared/Modal";
import type { Post } from "../../types";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function PostMenu({ post, onDeleted }: { post: Post; onDeleted?: () => void }) {
  const { user } = useAuth();
  const { isStaff: isCommunityStaff } = useCommunity();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmUnfollowOpen, setConfirmUnfollowOpen] = useState(false);

  const isOwnPost = user?.id === post.author.id;
  const isStaff = hasPermission(user?.role, "delete_posts") || isCommunityStaff;
  const canEdit = isOwnPost && Date.now() - new Date(post.createdAt).getTime() < EDIT_WINDOW_MS;
  const isPinned = isOwnPost && post.author.pinnedPostId === post.id;
  const canPin = isOwnPost && !post.parentPost;

  const deletePost = useDeletePost();
  const notInterested = useMarkNotInterested();
  const reportPost = useReportPost();
  const pinPost = usePinPost();
  const unpinPost = useUnpinPost();
  const followMutation = useFollowMutation(post.author.username);
  const muteMutation = useMuteMutation(post.author.username);
  const blockMutation = useBlockMutation(post.author.username);

  const close = () => setOpen(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        aria-label="More options"
      >
        <LuEllipsis className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div
            className="absolute right-0 z-40 mt-1 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            {isOwnPost ? (
              <>
                {canEdit && (
                  <MenuItem
                    icon={LuPencil}
                    label="Edit post"
                    onClick={() => {
                      setEditOpen(true);
                      close();
                    }}
                  />
                )}
                {canPin && (
                  <MenuItem
                    icon={isPinned ? LuPinOff : LuPin}
                    label={isPinned ? "Unpin" : "Pin"}
                    onClick={() => {
                      (isPinned ? unpinPost : pinPost).mutate(post.id);
                      close();
                    }}
                  />
                )}
                <MenuItem
                  icon={LuTrash2}
                  label="Delete post"
                  danger
                  onClick={() => {
                    setConfirmDeleteOpen(true);
                    close();
                  }}
                />
              </>
            ) : isStaff ? (
              <MenuItem
                icon={LuTrash2}
                label="Delete post (Staff)"
                danger
                onClick={() => {
                  setConfirmDeleteOpen(true);
                  close();
                }}
              />
            ) : (
              <>
                <MenuItem
                  label="Not interested in this post"
                  onClick={() => {
                    notInterested.mutate(post.id);
                    close();
                  }}
                />
                <MenuItem
                  label={post.author.isFollowedByMe ? `Unfollow @${post.author.username}` : `Follow @${post.author.username}`}
                  onClick={() => {
                    if (post.author.isFollowedByMe) {
                      setConfirmUnfollowOpen(true);
                    } else {
                      followMutation.mutate(false);
                    }
                    close();
                  }}
                />
                <MenuItem
                  label={post.author.isMutedByMe ? `Unmute @${post.author.username}` : `Mute @${post.author.username}`}
                  onClick={() => {
                    muteMutation.mutate(!!post.author.isMutedByMe);
                    close();
                  }}
                />
                <MenuItem
                  label={`Block @${post.author.username}`}
                  danger
                  onClick={() => {
                    blockMutation.mutate(false);
                    close();
                  }}
                />
                <MenuItem
                  label="Report post"
                  danger
                  onClick={() => {
                    setReportOpen(true);
                    close();
                  }}
                />
              </>
            )}
          </div>
        </>
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report post"
        isSubmitting={reportPost.isPending}
        onSubmit={(reason, details) => {
          reportPost.mutate(
            { id: post.id, reason, details },
            { onSuccess: () => setReportOpen(false) }
          );
        }}
      />

      <EditPostDialog post={post} open={editOpen} onClose={() => setEditOpen(false)} />

      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Delete post?">
        <div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This can't be undone. The post will be permanently deleted.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setConfirmDeleteOpen(false)}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deletePost.mutate(post.id, { onSuccess: () => onDeleted?.() });
                setConfirmDeleteOpen(false);
              }}
              disabled={deletePost.isPending}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={confirmUnfollowOpen} onClose={() => setConfirmUnfollowOpen(false)} title={`Unfollow @${post.author.username}?`}>
        <div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            You'll stop seeing their posts in your home timeline.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setConfirmUnfollowOpen(false)}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                followMutation.mutate(true);
                setConfirmUnfollowOpen(false);
              }}
              disabled={followMutation.isPending}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              Unfollow
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: IconType;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 ${danger ? "text-red-600 dark:text-red-400" : "text-neutral-800 dark:text-neutral-200"}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
