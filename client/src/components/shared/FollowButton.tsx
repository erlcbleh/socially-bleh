import { useState } from "react";
import { useFollowMutation } from "../../hooks/useProfile";
import { useGuestGate } from "../../lib/guestGate";
import { Modal } from "./Modal";
import type { User } from "../../types";

export function FollowButton({ user, className = "" }: { user: User; className?: string }) {
  const followMutation = useFollowMutation(user.username);
  const { requireAccount } = useGuestGate();
  const pending = user.followStatus === "pending";
  const areFriends = user.isFollowedByMe && user.isFollowingMe;
  const [confirmUnfollowOpen, setConfirmUnfollowOpen] = useState(false);

  const confirmModal = (
    <Modal open={confirmUnfollowOpen} onClose={() => setConfirmUnfollowOpen(false)} title={`Unfollow @${user.username}?`}>
      <div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          You'll stop seeing their posts in your home timeline{areFriends ? " and you'll no longer be friends" : ""}.
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
  );

  if (followMutation.isPending) {
    return (
      <button className={`rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium opacity-50 ${className}`} disabled>
        {user.isFollowedByMe ? (areFriends ? "Friends" : "Following") : user.isFollowingMe ? "Follow back" : "Follow"}
      </button>
    );
  }

  if (user.isFollowedByMe) {
    return (
      <>
        <button
          onClick={() => {
            if (requireAccount()) return;
            setConfirmUnfollowOpen(true);
          }}
          className={`rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-400 ${className}`}
        >
          {areFriends ? "Friends" : "Following"}
        </button>
        {confirmModal}
      </>
    );
  }

  if (pending) {
    return (
      <button
        onClick={() => {
          if (requireAccount()) return;
          followMutation.mutate(false);
        }}
        className={`rounded-full border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 text-sm font-medium text-neutral-500 ${className}`}
      >
        Requested
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        if (requireAccount()) return;
        followMutation.mutate(false);
      }}
      className={`rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 ${className}`}
    >
      {user.isFollowingMe ? "Follow back" : "Follow"}
    </button>
  );
}
