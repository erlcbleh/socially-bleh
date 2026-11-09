import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { hydrateUser, hydrateUsers, hydratePosts, POST_INCLUDE, POST_INCLUDE_WITH_PARENT } from "../services/hydrate.js";
import { notify } from "../services/notify.js";
import { emitToUsers, REALTIME_EVENTS } from "../services/realtime.js";
import { moderationFilter, isStaffRole, canViewPost } from "../services/moderationVisibility.js";
import { findMutualFriendUsers, findMutualsWith } from "../services/mutualUsers.js";
import { getGlobalCommunityId } from "../services/globalCommunity.js";
import { reportCreated } from "../services/staffEvents.js";
import { paginateRelationshipRows, parseRelationshipPageQuery } from "../utils/relationshipPagination.js";

const RELATIONSHIP_ORDER = [{ createdAt: "desc" }, { id: "desc" }];
const PROFILE_POST_LIMIT = 50;

function relationshipCursorWhere(cursor) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

function relationshipPageOptions(req, res) {
  try {
    return parseRelationshipPageQuery(req.query);
  } catch (error) {
    res.status(400).json({ message: error.message });
    return null;
  }
}

async function findFollowPage(where, userField, options) {
  const rows = await prisma.follow.findMany({
    where: { ...where, ...relationshipCursorWhere(options.cursor) },
    include: { [userField]: true },
    orderBy: RELATIONSHIP_ORDER,
    take: options.limit + 1,
  });
  return paginateRelationshipRows(rows, options.limit);
}

async function findBlockPage(where, options) {
  const rows = await prisma.block.findMany({
    where: { ...where, ...relationshipCursorWhere(options.cursor) },
    include: { blocked: true },
    orderBy: RELATIONSHIP_ORDER,
    take: options.limit + 1,
  });
  return paginateRelationshipRows(rows, options.limit);
}

async function hasBlocked(blockerId, blockedId) {
  const row = await prisma.block.findFirst({ where: { blockerId, blockedId }, select: { id: true } });
  return !!row;
}

async function isAcceptedFollower(followerId, followingId) {
  const row = await prisma.follow.findFirst({
    where: { followerId, followingId, status: "accepted" },
    select: { id: true },
  });
  return !!row;
}

async function findTarget(req) {
  const reqUsername = String(req.params.username || "").toLowerCase();
  let target = await prisma.user.findFirst({
    where: { username: reqUsername, status: { not: "deactivated" } },
  });
  if (!target) {
    target = await prisma.user.findFirst({
      where: {
        previousUsernames: {
          hasSome: [reqUsername],
        },
        status: { not: "deactivated" },
      },
    });
  }
  return target || null;
}

async function visibleCommunityIds(viewerId) {
  const rows = await prisma.communityMembership.findMany({
    where: { userId: viewerId, status: "active" },
    select: { communityId: true },
  });
  return rows.map((row) => row.communityId);
}

async function adjustCounts(userId, field, delta) {
  await prisma.user.update({ where: { id: userId }, data: { [field]: { increment: delta } } });
}

async function canSeeContent(target, req) {
  if (!req.user) return !target.isPrivate;
  if (target.id === req.user.id) return true;
  if (await hasBlocked(target.id, req.user.id) || await hasBlocked(req.user.id, target.id)) return false;
  if (!target.isPrivate) return true;
  return isAcceptedFollower(req.user.id, target.id);
}

async function respondWithPosts(req, res, { where, include, requireVisibleParent = false }) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (!(await canSeeContent(target, req))) return res.json({ posts: [] });

  const viewerId = req.user?.id ?? null;
  const isStaff = req.user ? isStaffRole(req.user.role) : false;
  const communityIds = req.user
    ? await visibleCommunityIds(viewerId)
    : [await getGlobalCommunityId()];

  let targetCommunityIds = communityIds;
  const requestedSlug = req.query.community || req.params.community;
  if (requestedSlug) {
    const community = await prisma.community.findFirst({
      where: { OR: [{ slug: String(requestedSlug).toLowerCase() }, { previousSlugs: { has: String(requestedSlug).toLowerCase() } }] },
      select: { id: true },
    });
    if (community) {
      targetCommunityIds = communityIds.filter((id) => id === community.id);
    } else {
      return res.json({ posts: [] });
    }
  }

  const posts = await prisma.post.findMany({
    where: {
      communityId: { in: targetCommunityIds },
      deleted: false,
      ...where(target),
      ...moderationFilter(viewerId, isStaff),
    },
    orderBy: { createdAt: "desc" },
    take: PROFILE_POST_LIMIT,
    include,
  });

  const visible = requireVisibleParent
    ? posts.filter((post) => {
        const parent = post.parentPost;
        return parent && !parent.deleted && canViewPost(parent, viewerId, isStaff);
      })
    : posts;

  res.json({ posts: await hydratePosts(visible, viewerId, await getGlobalCommunityId()) });
}

export async function getByUsername(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });

  const viewerId = req.user?.id;
  const isSelf = viewerId === target.id;
  const hasBlockedMe = viewerId && !isSelf ? await hasBlocked(target.id, viewerId) : false;
  const isBlockedByMe = viewerId && !isSelf ? await hasBlocked(viewerId, target.id) : false;

  const dto = await hydrateUser(target, viewerId, await getGlobalCommunityId());
  if (hasBlockedMe || isBlockedByMe) {
    dto.avatarUrl = "";
    dto.bannerUrl = "";
    dto.bio = "";
  }
  dto.hasBlockedMe = hasBlockedMe;
  dto.isBlockedByMe = isBlockedByMe;

  res.json({ user: dto });
}

export async function listUserPosts(req, res) {
  await respondWithPosts(req, res, {
    where: (target) => ({ authorId: target.id, parentPostId: null }),
    include: POST_INCLUDE,
  });
}

export async function listUserReplies(req, res) {
  await respondWithPosts(req, res, {
    where: (target) => ({ authorId: target.id, parentPostId: { not: null } }),
    include: POST_INCLUDE_WITH_PARENT,
    requireVisibleParent: true,
  });
}

export async function listUserMentions(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (!(await canSeeContent(target, req))) return res.json({ posts: [] });

  const viewerId = req.user.id;
  const isStaff = isStaffRole(req.user.role);
  const communityIds = await visibleCommunityIds(viewerId);

  let targetCommunityIds = communityIds;
  const requestedSlug = req.query.community || req.params.community;
  if (requestedSlug) {
    const community = await prisma.community.findFirst({
      where: { OR: [{ slug: String(requestedSlug).toLowerCase() }, { previousSlugs: { has: String(requestedSlug).toLowerCase() } }] },
      select: { id: true },
    });
    if (community) {
      targetCommunityIds = communityIds.filter((id) => id === community.id);
    } else {
      return res.json({ posts: [] });
    }
  }

  const escapedUsername = target.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mentionRegex = new RegExp(`(^|[^a-zA-Z0-9_])@${escapedUsername}(?![a-zA-Z0-9_])`, "i");
  const candidates = await prisma.post.findMany({
    where: {
      communityId: { in: targetCommunityIds },
      deleted: false,
      content: { contains: `@${target.username}`, mode: "insensitive" },
      ...moderationFilter(viewerId, isStaff),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: POST_INCLUDE,
  });
  const posts = candidates.filter((p) => mentionRegex.test(p.content)).slice(0, PROFILE_POST_LIMIT);

  res.json({ posts: await hydratePosts(posts, viewerId, await getGlobalCommunityId()) });
}

export async function follow(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ message: "Cannot follow yourself" });

  const globalCommunityId = await getGlobalCommunityId();

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: target.id, blockedId: req.user.id },
        { blockerId: req.user.id, blockedId: target.id },
      ],
    },
    select: { id: true },
  });
  if (blocked) return res.status(403).json({ message: "Cannot follow this account" });

  const existing = await prisma.follow.findFirst({
    where: { followerId: req.user.id, followingId: target.id },
    select: { id: true },
  });
  if (existing) return res.json({ user: await hydrateUser(target, req.user.id, globalCommunityId) });

  const status = target.isPrivate ? "pending" : "accepted";
  try {
    await prisma.follow.create({
      data: { id: newId(), followerId: req.user.id, followingId: target.id, status },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      return res.json({ user: await hydrateUser(target, req.user.id, globalCommunityId) });
    }
    throw err;
  }

  if (status === "accepted") {
    await Promise.all([
      adjustCounts(target.id, "followersCount", 1),
      adjustCounts(req.user.id, "followingCount", 1),
    ]);
    await notify({ recipient: target.id, actor: req.user.id, type: "follow", community: globalCommunityId });
    emitToUsers([req.user.id, target.id], REALTIME_EVENTS.socialChanged, { kind: "follow" });
  } else {
    await notify({ recipient: target.id, actor: req.user.id, type: "follow_request", community: globalCommunityId });
  }

  res.json({ user: await hydrateUser(target, req.user.id, globalCommunityId) });
}

export async function unfollow(req, res) {
  const target = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
  });
  if (!target) return res.status(404).json({ message: "User not found" });

  const existing = await prisma.follow.findFirst({
    where: { followerId: req.user.id, followingId: target.id },
  });
  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } });
    if (existing.status === "accepted") {
      await Promise.all([
        adjustCounts(target.id, "followersCount", -1),
        adjustCounts(req.user.id, "followingCount", -1),
      ]);
      emitToUsers([req.user.id, target.id], REALTIME_EVENTS.socialChanged, { kind: "unfollow" });
    }
  }

  res.json({ user: await hydrateUser(target, req.user.id, await getGlobalCommunityId()) });
}

export async function respondFollowRequest(req, res) {
  const follower = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
  });
  if (!follower) return res.status(404).json({ message: "User not found" });

  const request = await prisma.follow.findFirst({
    where: { followerId: follower.id, followingId: req.user.id, status: "pending" },
  });
  if (!request) return res.status(404).json({ message: "No pending request" });

  if (req.body.action === "accept") {
    await prisma.follow.update({ where: { id: request.id }, data: { status: "accepted" } });
    await Promise.all([
      adjustCounts(req.user.id, "followersCount", 1),
      adjustCounts(follower.id, "followingCount", 1),
    ]);
    await notify({
      recipient: follower.id,
      actor: req.user.id,
      type: "follow_accept",
      community: await getGlobalCommunityId(),
    });
    emitToUsers([req.user.id, follower.id], REALTIME_EVENTS.socialChanged, { kind: "follow" });
  } else {
    await prisma.follow.delete({ where: { id: request.id } });
  }

  res.json({ ok: true });
}

export async function listFollowRequests(req, res) {
  const options = relationshipPageOptions(req, res);
  if (!options) return;

  const { page, hasMore, nextCursor } = await findFollowPage(
    { followingId: req.user.id, status: "pending" },
    "follower",
    options
  );
  const users = page.map((request) => request.follower).filter(Boolean);
  res.json({
    users: await hydrateUsers(users, req.user.id, await getGlobalCommunityId()),
    hasMore,
    nextCursor,
  });
}

export async function listFollowers(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });

  const viewerId = req.user?.id;
  const isSelf = target.id === viewerId;

  if (!isSelf && target.isPrivate && !(await isAcceptedFollower(req.user.id, target.id))) {
    return res.json({ users: [], hidden: true, hasMore: false, nextCursor: null });
  }

  const options = relationshipPageOptions(req, res);
  if (!options) return;

  const { page, hasMore, nextCursor } = await findFollowPage(
    { followingId: target.id, status: "accepted" },
    "follower",
    options
  );
  const users = page.map((row) => row.follower).filter(Boolean);
  res.json({ users: await hydrateUsers(users, viewerId, await getGlobalCommunityId()), hasMore, nextCursor });
}

export async function listFollowing(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });

  const viewerId = req.user?.id;
  const isSelf = target.id === viewerId;

  if (!isSelf) {
    if (target.hideFollowing) return res.json({ users: [], hidden: true, hasMore: false, nextCursor: null });
    if (target.isPrivate && !(await isAcceptedFollower(req.user.id, target.id))) {
      return res.json({ users: [], hidden: true, hasMore: false, nextCursor: null });
    }
  }

  const options = relationshipPageOptions(req, res);
  if (!options) return;

  const { page, hasMore, nextCursor } = await findFollowPage(
    { followerId: target.id, status: "accepted" },
    "following",
    options
  );
  const users = page.map((row) => row.following).filter(Boolean);
  res.json({ users: await hydrateUsers(users, viewerId, await getGlobalCommunityId()), hasMore, nextCursor });
}

export async function listMutualFriends(req, res) {
  const viewerId = req.user.id;
  const users = await findMutualFriendUsers(viewerId, req.query.q);
  res.json({ users: await hydrateUsers(users, viewerId, await getGlobalCommunityId()) });
}

export async function listMutualsWith(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });

  const viewerId = req.user.id;
  if (target.id === viewerId) return res.json({ count: 0, users: [] });

  if (target.isPrivate && !(await isAcceptedFollower(viewerId, target.id))) {
    return res.json({ count: 0, users: [] });
  }

  const { count, users } = await findMutualsWith(viewerId, target.id);

  res.json({
    count,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl || "",
    })),
  });
}

export async function blockUser(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ message: "Cannot block yourself" });

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.user.id, blockedId: target.id } },
    create: { id: newId(), blockerId: req.user.id, blockedId: target.id },
    update: {},
  });

  const [removedIFollowThem, removedTheyFollowMe] = await Promise.all([
    prisma.follow.findFirst({ where: { followerId: req.user.id, followingId: target.id } }),
    prisma.follow.findFirst({ where: { followerId: target.id, followingId: req.user.id } }),
  ]);

  if (removedIFollowThem) {
    await prisma.follow.delete({ where: { id: removedIFollowThem.id } });
    if (removedIFollowThem.status === "accepted") {
      await Promise.all([
        adjustCounts(target.id, "followersCount", -1),
        adjustCounts(req.user.id, "followingCount", -1),
      ]);
    }
  }
  if (removedTheyFollowMe) {
    await prisma.follow.delete({ where: { id: removedTheyFollowMe.id } });
    if (removedTheyFollowMe.status === "accepted") {
      await Promise.all([
        adjustCounts(req.user.id, "followersCount", -1),
        adjustCounts(target.id, "followingCount", -1),
      ]);
    }
  }

  res.json({ user: await hydrateUser(target, req.user.id, await getGlobalCommunityId()) });
}

export async function unblockUser(req, res) {
  const target = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
  });
  if (!target) return res.status(404).json({ message: "User not found" });
  await prisma.block.deleteMany({ where: { blockerId: req.user.id, blockedId: target.id } });
  res.json({ user: await hydrateUser(target, req.user.id, await getGlobalCommunityId()) });
}

export async function listBlocked(req, res) {
  const options = relationshipPageOptions(req, res);
  if (!options) return;

  const { page, hasMore, nextCursor } = await findBlockPage({ blockerId: req.user.id }, options);
  const blockedUsers = page.map((block) => block.blocked).filter(Boolean);
  const users = await hydrateUsers(blockedUsers, req.user.id, await getGlobalCommunityId());
  res.json({ users: users.map((user) => ({ ...user, isBlockedByMe: true })), hasMore, nextCursor });
}

export async function muteUser(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ message: "Cannot mute yourself" });

  await prisma.mute.upsert({
    where: { muterId_mutedId: { muterId: req.user.id, mutedId: target.id } },
    create: { id: newId(), muterId: req.user.id, mutedId: target.id },
    update: {},
  });
  res.json({ user: await hydrateUser(target, req.user.id, await getGlobalCommunityId()) });
}

export async function unmuteUser(req, res) {
  const target = await prisma.user.findFirst({
    where: { username: String(req.params.username || "").toLowerCase() },
  });
  if (!target) return res.status(404).json({ message: "User not found" });
  await prisma.mute.deleteMany({ where: { muterId: req.user.id, mutedId: target.id } });
  res.json({ user: await hydrateUser(target, req.user.id, await getGlobalCommunityId()) });
}

export async function reportUser(req, res) {
  const target = await findTarget(req);
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.id === req.user.id) return res.status(400).json({ message: "Cannot report yourself" });

  const report = await prisma.report.create({
    data: {
      id: newId(),
      reporterId: req.user.id,
      communityId: await getGlobalCommunityId(),
      targetType: "user",
      targetId: target.id,
      reason: String(req.body.reason || "unspecified").trim().slice(0, 100),
      details: String(req.body.details || "").trim().slice(0, 500),
    },
  });

  reportCreated(report);

  res.status(201).json({ report: { id: report.id } });
}
