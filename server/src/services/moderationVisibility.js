import { hasPermission } from "../config/roles.js";

export function moderationFilter(viewerId, isStaff) {
  if (isStaff) return {};
  return {
    author: { status: { not: "deactivated" } },
    OR: [{ moderationStatus: { not: "flagged" } }, { authorId: viewerId }],
  };
}

export function canViewPost(post, viewerId, isStaff) {
  if (isStaff) return true;

  const authorId = post.authorId || post.author?.id || post.author;
  const isOwn = String(authorId) === String(viewerId);

  if (post.author?.status === "deactivated" && !isOwn) return false;
  if (post.moderationStatus !== "flagged") return true;
  return isOwn;
}

export function isStaffRole(role) {
  return hasPermission(role, "access_staff_panel");
}
