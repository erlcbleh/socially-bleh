import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { serializeUser } from "../services/hydrate.js";
import { logStaffAction } from "../services/auditLog.js";
import { reportUpdated } from "../services/staffEvents.js";
import { notify } from "../services/notify.js";
import {
  STAFF_MAX_PAGE_SIZE,
  parseLimit,
  parseCursor,
  withCursor,
  takePage,
} from "../utils/staffPagination.js";

const REPORT_STATUSES = ["pending", "actioned", "dismissed"];

export async function listStaffCommunities(req, res) {
  const ids = [...(req.staff?.communityRoles?.keys() ?? [])];
  const isGlobalStaff = Boolean(req.staff?.isGlobalStaff);
  const q = String(req.query.q || "").trim();

  const scopeWhere = isGlobalStaff ? {} : { id: { in: ids } };
  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const communities = await prisma.community.findMany({
    where: { AND: [scopeWhere, searchWhere] },
    orderBy: [{ isGlobal: "desc" }, { memberCount: "desc" }],
    take: STAFF_MAX_PAGE_SIZE,
    include: { owner: true },
  });

  const communityIds = communities.map((community) => community.id);

  const pendingReports = communityIds.length
    ? await prisma.report.groupBy({
        by: ["communityId"],
        where: { communityId: { in: communityIds }, status: "pending" },
        _count: { _all: true },
      })
    : [];

  const pendingMap = new Map(pendingReports.map((row) => [row.communityId, row._count._all]));

  res.json({
    communities: communities.map((community) => ({
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description || "",
      logoUrl: community.logoUrl || "",
      joinPolicy: community.joinPolicy,
      isGlobal: community.isGlobal,
      memberCount: community.memberCount,
      postCount: community.postCount,
      createdAt: community.createdAt,
      owner: community.owner ? serializeUser(community.owner, {}) : null,
      role: req.staff?.communityRoles?.get(String(community.id)) || null,
      viaGlobalStaff: !req.staff?.communityRoles?.has(String(community.id)) && isGlobalStaff,
      pendingReports: pendingMap.get(community.id) || 0,
    })),
  });
}

export async function transferCommunityOwnership(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Community not found." });
  }

  const rawTarget = String(req.body?.toUsername || req.body?.username || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  const demoteRole = ["staff", "member"].includes(req.body?.demoteTo) ? req.body.demoteTo : "staff";
  if (!rawTarget) {
    return res.status(400).json({ message: "A new owner username is required." });
  }

  const community = await prisma.community.findUnique({
    where: { id: req.params.id },
    include: { owner: true },
  });
  if (!community) return res.status(404).json({ message: "Community not found." });
  if (community.isGlobal) {
    return res.status(400).json({ message: "The global community can't be transferred." });
  }

  const newOwner = await prisma.user.findFirst({ where: { username: rawTarget } });
  if (!newOwner) return res.status(404).json({ message: `No user named @${rawTarget}.` });
  if (community.ownerId === newOwner.id) {
    return res.status(400).json({ message: `@${newOwner.username} already owns this community.` });
  }

  const [newMembership, oldMembership] = await Promise.all([
    prisma.communityMembership.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: newOwner.id } },
    }),
    community.ownerId
      ? prisma.communityMembership.findUnique({
          where: { communityId_userId: { communityId: community.id, userId: community.ownerId } },
        })
      : Promise.resolve(null),
  ]);

  if (newMembership?.status === "banned") {
    return res.status(400).json({ message: `@${newOwner.username} is banned from this community.` });
  }

  await prisma.$transaction(async (tx) => {
    if (oldMembership && oldMembership.userId !== newOwner.id) {
      await tx.communityMembership.update({
        where: { id: oldMembership.id },
        data: { role: demoteRole },
      });
    }

    if (newMembership) {
      await tx.communityMembership.update({
        where: { id: newMembership.id },
        data: { role: "owner", status: "active", bannedReason: null, bannedById: null, bannedUntil: null },
      });
    } else {
      await tx.communityMembership.create({
        data: {
          id: newId(),
          communityId: community.id,
          userId: newOwner.id,
          role: "owner",
          status: "active",
        },
      });
      await tx.community.update({
        where: { id: community.id },
        data: { memberCount: { increment: 1 } },
      });
    }

    await tx.community.update({
      where: { id: community.id },
      data: {
        ownerId: newOwner.id,
        discordWebhookUrl: null,
        discordWebhookChannelId: null,
        discordWebhookChannelName: null,
      },
    });
  });

  await logStaffAction({
    staffId: req.user?.id || req.staffUser?.id,
    action: "transfer_community_ownership",
    targetType: "community",
    targetId: community.id,
    targetUser: newOwner.id,
    targetLabel: community.slug,
    communityId: community.id,
    important: true,
    meta: {
      previousOwnerId: community.ownerId ?? null,
      previousOwnerUsername: community.owner?.username ?? null,
      newOwnerUsername: newOwner.username,
      demotedTo: oldMembership ? demoteRole : null,
    },
  });

  res.json({
    ok: true,
    community: { id: community.id, slug: community.slug, name: community.name },
    newOwner: serializeUser(newOwner, {}),
    previousOwner: community.owner ? serializeUser(community.owner, {}) : null,
    demotedTo: oldMembership ? demoteRole : null,
  });
}

export async function getCommunityUserDetails(req, res) {
  const username = String(req.params.username || "").toLowerCase();

  const user = await prisma.user.findFirst({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      isVerified: true,
      createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ message: "User not found" });

  const membership = await prisma.communityMembership.findFirst({
    where: { communityId: req.community.id, userId: user.id },
    include: { bannedBy: { select: { username: true } } },
  });
  if (!membership) {
    return res.status(404).json({ message: "That account is not a member of this community." });
  }

  const postIds = await prisma.post.findMany({
    where: { authorId: user.id, communityId: req.community.id },
    select: { id: true },
    take: 2000,
  });

  const [postsTotal, postsDeleted, reportsFiled, reportsAgainstUser, reportsAgainstPosts, auditEntries] =
    await Promise.all([
      prisma.post.count({ where: { authorId: user.id, communityId: req.community.id, deleted: false } }),
      prisma.post.count({ where: { authorId: user.id, communityId: req.community.id, deleted: true } }),
      prisma.report.count({ where: { reporterId: user.id, communityId: req.community.id } }),
      prisma.report.count({
        where: { communityId: req.community.id, targetType: "user", targetId: user.id },
      }),
      postIds.length
        ? prisma.report.count({
            where: {
              communityId: req.community.id,
              targetType: "post",
              targetId: { in: postIds.map((post) => post.id) },
            },
          })
        : Promise.resolve(0),
      prisma.staffAuditLog.findMany({
        where: { communityId: req.community.id, targetUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { staff: { select: { username: true } } },
      }),
    ]);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      isVerified: user.isVerified,
    },
    community: { slug: req.community.slug, name: req.community.name },
    membership: {
      role: membership.role,
      status: membership.status,
      joinedAt: membership.createdAt,
      postsCount: membership.postsCount,
      professionalStatus: membership.professionalStatus,
      verificationStatus: membership.verificationStatus,
      bannedReason: membership.bannedReason,
      bannedUntil: membership.bannedUntil,
      bannedBy: membership.bannedBy?.username || null,
    },
    activity: { postsTotal, postsDeleted },
    moderation: { reportsFiled, reportsAgainstUser, reportsAgainstPosts },
    auditEntries: auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      staff: entry.staff?.username || null,
      targetLabel: entry.targetLabel,
      createdAt: entry.createdAt,
    })),
  });
}

export async function listCommunityReports(req, res) {
  const status = REPORT_STATUSES.includes(req.query.status) ? req.query.status : "pending";
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await prisma.report.findMany({
    where: withCursor({ communityId: req.community.id, status }, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { reporter: true, reviewedBy: true },
  });

  const { page, nextCursor } = takePage(rows, limit);

  const postIds = page.filter((row) => row.targetType === "post").map((row) => row.targetId);
  const userIds = page.filter((row) => row.targetType === "user").map((row) => row.targetId);

  const [posts, users] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, content: true, deleted: true, authorId: true, author: true },
        })
      : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } } }) : [],
  ]);

  const postMap = new Map(posts.map((post) => [post.id, post]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  res.json({
    items: page.map((report) => {
      const post = postMap.get(report.targetId);
      const targetUser = userMap.get(report.targetId);
      return {
        id: report.id,
        source: report.source,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        details: report.details,
        status: report.status,
        actionTaken: report.actionTaken,
        staffNote: report.staffNote,
        content: report.contentSnapshot || post?.content || "",
        targetDeleted: report.targetType === "post" ? Boolean(post?.deleted) : false,
        targetUsername: targetUser?.username || post?.author?.username || null,
        reporter: report.reporter ? serializeUser(report.reporter, {}) : null,
        reviewedBy: report.reviewedBy ? serializeUser(report.reviewedBy, {}) : null,
        createdAt: report.createdAt,
      };
    }),
    nextCursor,
  });
}

const COMMUNITY_ACTIONS = ["dismiss", "kick", "ban"];

export async function actionCommunityReport(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Report not found" });

  const action = String(req.body?.action || "");
  if (!COMMUNITY_ACTIONS.includes(action)) {
    return res.status(400).json({ message: "Community moderation supports dismiss, kick and ban." });
  }

  const report = await prisma.report.findFirst({
    where: { id: req.params.id, communityId: req.community.id },
  });
  if (!report) return res.status(404).json({ message: "Report not found" });
  if (report.status !== "pending") {
    return res.status(409).json({ message: "That report has already been decided." });
  }

  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  const staffNote = typeof req.body?.staffNote === "string"
    ? String(req.body.staffNote).trim().slice(0, 2000)
    : null;

  let targetUserId = null;
  if (report.targetType === "user") {
    targetUserId = report.targetId;
  } else if (report.targetType === "post") {
    const post = await prisma.post.findUnique({
      where: { id: report.targetId },
      select: { authorId: true, communityId: true },
    });
    if (post && post.communityId === req.community.id) targetUserId = post.authorId;
  }

  let actionTaken = "";

  if (action === "dismiss") {
    actionTaken = "dismissed";
  } else {
    if (!targetUserId) return res.status(404).json({ message: "Target member not found" });
    if (targetUserId === req.staffUser.id) {
      return res.status(400).json({ message: "You can't moderate your own account." });
    }
    if (action === "ban" && !reason) {
      return res.status(400).json({ message: "A reason is required to ban a member." });
    }

    const targetMembership = await prisma.communityMembership.findFirst({
      where: { communityId: req.community.id, userId: targetUserId },
      include: { user: { select: { username: true } } },
    });
    if (!targetMembership) {
      return res.status(404).json({ message: "That account is not a member of this community." });
    }

    if (targetMembership.role === "owner" && req.communityRole === "staff") {
      return res.status(403).json({ message: "You can't action a report about the community owner." });
    }
    if (targetMembership.role === "owner" && req.communityRole === "owner") {
      return res.status(400).json({ message: "You can't moderate your own account." });
    }

    let bannedUntil = null;
    if (action === "ban" && req.body?.until) {
      bannedUntil = new Date(req.body.until);
      if (Number.isNaN(bannedUntil.getTime()) || bannedUntil <= new Date()) {
        return res.status(400).json({ message: "A ban expiry must be a date in the future." });
      }
    }

    const wasActive = targetMembership.status === "active";

    await prisma.communityMembership.update({
      where: { id: targetMembership.id },
      data:
        action === "ban"
          ? {
              status: "banned",
              bannedReason: reason,
              bannedById: req.staffUser.id,
              bannedUntil,
            }
          : { status: "kicked" },
    });

    if (wasActive) {
      await prisma.community.updateMany({
        where: { id: req.community.id, memberCount: { gt: 0 } },
        data: { memberCount: { decrement: 1 } },
      });
    }

    actionTaken = action === "ban" ? "banned_from_community" : "kicked_from_community";

    await logStaffAction({
      staffId: req.staffUser.id,
      action: action === "ban" ? "ban_member" : "kick_member",
      targetType: "user",
      targetId: targetUserId,
      targetUser: targetUserId,
      targetLabel: `@${targetMembership.user?.username || "unknown"}`,
      community: req.communityRole ? req.community.id : null,
      meta: { reportId: report.id, reason: reason || undefined },
    });
  }

  await prisma.report.update({
    where: { id: report.id },
    data: {
      status: action === "dismiss" ? "dismissed" : "actioned",
      actionTaken,
      reviewedById: req.staffUser.id,
      reviewedAt: new Date(),
      ...(staffNote ? { staffNote } : {}),
    },
  });

  await logStaffAction({
    staffId: req.staffUser.id,
    action: action === "dismiss" ? "dismiss_report" : "action_community_report",
    targetType: "report",
    targetId: report.id,
    targetLabel: `report ${report.id.slice(-8)}`,
    community: req.communityRole ? req.community.id : null,
    meta: { communitySlug: req.community.slug, decision: action },
  });

  reportUpdated(report);

  if (report.reporterId) {
    await notify({
      recipient: report.reporterId,
      actor: req.staffUser.id,
      type: action === "dismiss" ? "report_dismissed" : "report_actioned",
      post: report.targetType === "post" ? report.targetId : null,
      community: req.community.id,
    });
  }

  res.json({ ok: true, actionTaken });
}

export async function listCommunityStaffAuditLog(req, res) {
  const limit = parseLimit(req.query.limit);
  const cursor = parseCursor(req.query.cursor);

  const rows = await prisma.staffAuditLog.findMany({
    where: withCursor({ communityId: req.community.id }, cursor),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { staff: true, targetUser: true },
  });

  const { page, nextCursor } = takePage(rows, limit);

  res.json({
    items: page.map((entry) => ({
      id: entry.id,
      staff: entry.staff ? serializeUser(entry.staff, {}) : null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      targetUser: entry.targetUser ? serializeUser(entry.targetUser, {}) : null,
      targetLabel: entry.targetLabel,
      meta: entry.meta,
      createdAt: entry.createdAt,
    })),
    nextCursor,
  });
}
