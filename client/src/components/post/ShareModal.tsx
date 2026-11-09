import { useEffect, useState } from "react";
import { LuLink, LuSend, LuCheck, LuSearch, LuArrowLeft } from "react-icons/lu";
import { Modal } from "../shared/Modal";
import { Avatar } from "../shared/Avatar";
import { UserBadges } from "../shared/UserBadges";
import { PostEmbedPreview } from "./PostEmbedPreview";
import { useMutualFriends, useSharePost } from "../../hooks/useMessages";
import type { Post, User } from "../../types";

export function ShareModal({
  post,
  link,
  open,
  onClose,
  onCopied,
}: {
  post: Post;
  link: string;
  open: boolean;
  onClose: () => void;
  onCopied: () => void;
}) {
  const [step, setStep] = useState<"choose" | "pick">("choose");
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { data } = useMutualFriends(query, open && step === "pick");
  const sharePost = useSharePost();

  useEffect(() => {
    if (open) {
      setStep("choose");
      setQuery("");
      setCaption("");
      setSentTo(null);
      sharePost.reset();
    }
    
  }, [open]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(link);
    onCopied();
    onClose();
  };

  const handleSend = (u: User) => {
    sharePost.mutate(
      { username: u.username, content: caption.trim(), postId: post.id },
      {
        onSuccess: () => {
          setSentTo(u.username);
          setTimeout(() => onClose(), 1200);
        },
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Share" size="sm">
      {step === "choose" && (
        <div className="mt-1 space-y-1">
          <button
            onClick={handleCopyLink}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <LuLink className="h-4 w-4" />
            </span>
            Copy link
          </button>
          <button
            onClick={() => setStep("pick")}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <LuSend className="h-4 w-4" />
            </span>
            Send to a friend
          </button>
        </div>
      )}

      {step === "pick" && (
        <div>
          {!sentTo && (
            <button
              onClick={() => setStep("choose")}
              className="-ml-1.5 flex items-center gap-1 rounded-full px-1.5 py-1 text-sm text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <LuArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          <PostEmbedPreview post={post} />

          {sentTo ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <LuCheck className="h-8 w-8 text-green-600" />
              <p className="text-sm text-neutral-500">Sent to @{sentTo}</p>
            </div>
          ) : (
            <>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={1000}
                placeholder="Add a message (optional)"
                className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
              />

              <div className="relative mt-2">
                <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search friends"
                  className="w-full rounded-full border border-neutral-300 bg-transparent py-1.5 pl-9 pr-3 text-sm outline-none focus:border-brand dark:border-neutral-700"
                />
              </div>

              <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                {data?.users.length === 0 && (
                  <p className="py-6 text-center text-sm text-neutral-400">
                    No mutual friends yet, you can only share with people you both follow.
                  </p>
                )}
                {data?.users.map((u) => (
                  <button
                    key={u.id}
                    disabled={sharePost.isPending}
                    onClick={() => handleSend(u)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-neutral-50 disabled:opacity-60 dark:hover:bg-neutral-800"
                  >
                    <Avatar user={u} size={9} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-medium">{u.displayName}</p>
                        <UserBadges user={u} className="h-3.5 w-3.5" />
                      </div>
                      <p className="truncate text-sm text-neutral-500">@{u.username}</p>
                    </div>
                  </button>
                ))}
              </div>

              {sharePost.isError && <p className="mt-2 text-sm text-red-500">{(sharePost.error as Error).message}</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
