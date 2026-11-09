import { useEffect, useState } from "react";
import { Modal } from "../shared/Modal";
import { useEditPost } from "../../hooks/usePosts";
import type { Post } from "../../types";

const MAX_LEN = 500;

export function EditPostDialog({ post, open, onClose }: { post: Post; open: boolean; onClose: () => void }) {
  const [content, setContent] = useState(post.content);
  const editPost = useEditPost();

  useEffect(() => {
    if (open) setContent(post.content);
  }, [open, post.content]);

  const canSubmit =
    content.length <= MAX_LEN &&
    (content.trim().length > 0 || !!post.gifUrl || !!post.mediaUrl || !!post.poll || !!post.quotedPost);

  const submit = () => {
    if (!canSubmit || editPost.isPending) return;
    editPost.mutate({ id: post.id, content: content.trim() }, { onSuccess: onClose });
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit post">
      <div>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-neutral-200 p-3 text-[15px] outline-none focus:border-brand dark:border-neutral-700 dark:bg-neutral-900"
        />
        {editPost.isError && <p className="mt-1 text-sm text-red-500">{(editPost.error as Error).message}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs ${content.length > MAX_LEN ? "text-red-500" : "text-neutral-400"}`}>
            {content.length}/{MAX_LEN}
          </span>
          <button
            onClick={submit}
            disabled={!canSubmit || editPost.isPending}
            className="rounded-lg bg-brand px-4 py-1.5 font-medium text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
