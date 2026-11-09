import { api } from "./api";

export function logClick(slug: string, targetUsername: string, postId?: string) {
  api.post(`/communities/${slug}/analytics/click`, { targetUsername, postId }).catch(() => {});
}
