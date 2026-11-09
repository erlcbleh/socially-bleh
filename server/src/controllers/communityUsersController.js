import { hydrateUsers } from "../services/hydrate.js";
import { searchCommunityUsers } from "../services/communityUserSearch.js";

export async function searchUsers(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [] });

  const users = await searchCommunityUsers(req.community.id, q, 20);
  const viewerId = req.user?.id;
  res.json({ users: await hydrateUsers(users, viewerId, req.community.id) });
}
