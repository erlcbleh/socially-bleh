import { useParams, useNavigate } from "react-router-dom";
import { LuArrowLeft } from "react-icons/lu";
import { usePost, useComments } from "../hooks/usePosts";
import { PostCard } from "../components/post/PostCard";
import { Composer } from "../components/post/Composer";
import { useAuth } from "../lib/authContext";
import FlickerSpinner from "../components/shared/FlickerSpinner";

export default function PostDetailPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: postData, isLoading } = usePost(postId);
  const { data: commentsData, loadMore, isLoadingMore, loadMoreError } = useComments(postId);

  if (isLoading) return <div className="flex justify-center p-6"><FlickerSpinner /></div>;
  if (!postData?.post) return <p className="p-6 text-center text-neutral-400">Post not found</p>;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-4 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Back">
          <LuArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-medium">Post</h1>
      </div>

      <PostCard post={postData.post} expanded onDeleted={() => navigate(-1)} />
      {user && <Composer parentPostId={postData.post.id} placeholder="Post your reply" />}

      {commentsData?.posts.map((comment) => (
        <PostCard key={comment.id} post={comment} />
      ))}

      {commentsData?.hasMore && commentsData.nextCursor && (
        <div className="border-t border-neutral-200 p-4 text-center dark:border-neutral-800">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {isLoadingMore ? "Loading..." : "Load more replies"}
          </button>
          {loadMoreError && (
            <p className="mt-2 text-sm text-red-600" role="status">
              Couldn't load more replies. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
