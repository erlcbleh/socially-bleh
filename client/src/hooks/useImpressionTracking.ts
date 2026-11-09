import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useCommunitySlug } from "./useCommunitySlug";

const queues = new Map<string, Set<string>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function flush(slug: string) {
  const queue = queues.get(slug);
  if (!queue || queue.size === 0) return;
  const postIds = [...queue];
  queues.set(slug, new Set());
  api.post(`/communities/${slug}/analytics/impressions`, { postIds }).catch(() => {});
}

function schedule(slug: string, postId: string) {
  if (!queues.has(slug)) queues.set(slug, new Set());
  queues.get(slug)!.add(postId);
  const existing = timers.get(slug);
  if (existing) clearTimeout(existing);
  timers.set(
    slug,
    setTimeout(() => flush(slug), 2000)
  );
}

export function useImpressionTracking(postId: string) {
  const slug = useCommunitySlug();
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !seen.current) {
            seen.current = true;
            schedule(slug, postId);
          }
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [postId, slug]);

  return ref;
}
