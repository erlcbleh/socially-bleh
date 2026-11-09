import { useBookmarks } from "../hooks/usePosts";
import { PostCard } from "../components/post/PostCard";
import FlickerSpinner from "../components/shared/FlickerSpinner";

export default function BookmarksPage() {
  const { data, isLoading } = useBookmarks();

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white/80 p-3 backdrop-blur dark:bg-black/80">
        <h1 className="text-xl font-medium">Bookmarks</h1>
      </div>

      {isLoading && <div className="flex justify-center p-6"><FlickerSpinner /></div>}
      {!isLoading && data?.posts.length === 0 && (
        <p className="p-6 text-center text-neutral-400">Save posts for later by tapping the bookmark icon.</p>
      )}

      {data?.posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
