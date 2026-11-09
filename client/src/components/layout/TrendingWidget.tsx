import { communityPath } from "../../lib/communityPath";
import { Link } from "react-router-dom";
import { useTrending } from "../../hooks/useTrending";
import { useNavCommunitySlug } from "../../hooks/useCommunitySlug";

export function TrendingWidget() {
  const { data } = useTrending();
  const slug = useNavCommunitySlug();

  if (!slug || !data?.tags?.length) return null;

  return (
    <div className="card-surface rounded-xl p-3">
      <h2 className="px-1 text-xl font-medium">Trending</h2>
      <div className="space-y-3">
        {data.tags.map((t, i) => (
          <div key={t.tag} className="min-w-0 rounded-lg px-1 py-1">
            <Link
              to={communityPath(slug, `explore?q=${encodeURIComponent(t.tag)}`)}
              title={t.tag}
              className="block truncate font-medium text-brand hover:underline"
            >
              {t.tag}
            </Link>
            <p className="text-xs text-neutral-500">
              {t.count.toLocaleString()} {t.count === 1 ? "post" : "posts"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
