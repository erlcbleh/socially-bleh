const COMMUNITY_COLORS = ["bg-red-500", "bg-blue-500", "bg-amber-500", "bg-violet-500"];

export function colorForCommunity(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return COMMUNITY_COLORS[Math.abs(hash) % COMMUNITY_COLORS.length];
}
