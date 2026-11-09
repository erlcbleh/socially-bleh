import { prisma } from "../db/prisma.js";
import { cacheDel } from "../db/redis.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { serializeUser } from "../services/hydrate.js";
import { logStaffAction } from "../services/auditLog.js";
import { banAndDeleteAccount } from "../services/banAndDeleteAccount.js";
import { disconnectUser, disconnectStaffUser } from "../services/realtime.js";
import { roleLevel } from "../config/roles.js";
import { parseLimit } from "../utils/staffPagination.js";

const LIST_LIMIT = 50;
const REASON_MAX = 500;
const LABEL_MAX = 280;

const isElevatedStaff = (req) => roleLevel(req.staff?.role) >= roleLevel("admin");

function serializeBusiness(business, stats = {}) {
  return {
    id: business.id,
    username: business.username,
    displayName: business.displayName || business.username,
    bio: business.bio || "",
    avatarUrl: business.avatarUrl || "",
    bannerUrl: business.bannerUrl || "",
    createdAt: business.createdAt,
    accountLabel: business.accountLabel || "",
    owner: business.businessOwner ? serializeUser(business.businessOwner, {}) : null,
    postsCount: stats.postsCount ?? 0,
    followersCount: business.followersCount ?? 0,
    collaboratorCount: stats.collaboratorCount ?? 0,
  };
}

function serializeDeletedBusiness(row) {
  return {
    id: row.id,
    businessUserId: row.businessUserId,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    bannerUrl: row.bannerUrl,
    ownerId: row.ownerId,
    ownerUsername: row.ownerUsername,
    collaborators: Array.isArray(row.collaborators) ? row.collaborators : [],
    discord: {
      inviteUrl: row.discordInviteUrl || "",
      guildId: row.discordGuildId || null,
      guildName: row.discordGuildName || "",
      memberCount: row.discordMemberCount || 0,
    },
    postsCount: row.postsCount,
    followersCount: row.followersCount,
    approvedAt: row.approvedAt,
    accountCreatedAt: row.accountCreatedAt,
    reason: row.reason,
    deletedByUsername: row.deletedByUsername,
    deletedAt: row.deletedAt,
  };
}

export async function listBusinessAccounts(req, res) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = parseLimit(req.query.limit, { fallback: LIST_LIMIT, max: LIST_LIMIT });

  const businesses = await prisma.user.findMany({
    where: {
      accountKind: "business",
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { businessOwner: true },
  });

  const ids = businesses.map((b) => b.id);
  const [postCounts, collaboratorCounts] = await Promise.all([
    ids.length
      ? prisma.post.groupBy({ by: ["authorId"], where: { authorId: { in: ids }, deleted: false }, _count: true })
      : [],
    ids.length
      ? prisma.businessCollaborator.groupBy({ by: ["businessUserId"], where: { businessUserId: { in: ids } }, _count: true })
      : [],
  ]);

  const postMap = new Map(postCounts.map((row) => [row.authorId, row._count]));
  const collabMap = new Map(collaboratorCounts.map((row) => [row.businessUserId, row._count]));

  res.json({
    businesses: businesses.map((business) =>
      serializeBusiness(business, {
        postsCount: postMap.get(business.id) || 0,
        collaboratorCount: collabMap.get(business.id) || 0,
      })
    ),
    canDelete: isElevatedStaff(req),
  });
}

export async function listDeletedBusinesses(req, res) {
  const q = String(req.query.q || "").trim().toLowerCase();
  const limit = parseLimit(req.query.limit, { fallback: LIST_LIMIT, max: LIST_LIMIT });

  const rows = await prisma.deletedBusiness.findMany({
    where: q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { deletedAt: "desc" },
    take: limit,
  });

  res.json({ businesses: rows.map(serializeDeletedBusiness) });
}

export async function setBusinessLabel(req, res) {
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Business account not found." });
  }

  const label = String(req.body?.label ?? "").replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);

  const business = await prisma.user.findFirst({
    where: { id: req.params.id, accountKind: "business" },
    include: { businessOwner: true },
  });
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const previous = business.accountLabel || "";
  if (previous === label) {
    return res.json({ ok: true, accountLabel: label });
  }

  await prisma.user.update({
    where: { id: business.id },
    data: { accountLabel: label },
  });

  await cacheDel(`user:session:${business.id}`);

  await logStaffAction({
    staffId: req.user.id,
    action: label ? "set_business_label" : "clear_business_label",
    targetType: "user",
    targetId: business.id,
    targetUser: business.businessOwnerId || undefined,
    targetLabel: `@${business.username}`,
    meta: {
      label: label || undefined,
      previousLabel: previous || undefined,
    },
  });

  res.json({ ok: true, accountLabel: label });
}

export async function deleteBusinessAccount(req, res) {
  if (!isElevatedStaff(req)) {
    return res.status(403).json({ message: "Only admins and above can delete a business account." });
  }
  if (!isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Business account not found." });
  }

  const reason = String(req.body?.reason || "").trim().slice(0, REASON_MAX);
  if (!reason) {
    return res.status(400).json({ message: "A reason is required to delete a business account." });
  }

  const business = await prisma.user.findFirst({
    where: { id: req.params.id, accountKind: "business" },
    include: { businessOwner: true },
  });
  if (!business) return res.status(404).json({ message: "Business account not found." });

  const [collaborators, application, postsCount] = await Promise.all([
    prisma.businessCollaborator.findMany({
      where: { businessUserId: business.id },
      include: { user: true },
    }),
    prisma.businessApplication.findFirst({
      where: { businessUserId: business.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.count({ where: { authorId: business.id, deleted: false } }),
  ]);

  const snapshot = await prisma.deletedBusiness.create({
    data: {
      id: newId(),
      businessUserId: business.id,
      username: business.username || "",
      displayName: business.displayName || "",
      bio: business.bio || "",
      avatarUrl: business.avatarUrl || "",
      bannerUrl: business.bannerUrl || "",
      ownerId: business.businessOwnerId || null,
      ownerUsername: business.businessOwner?.username || "",
      collaborators: collaborators.map((row) => ({
        id: row.userId,
        username: row.user?.username || "",
        displayName: row.user?.displayName || "",
        role: row.role,
      })),
      discordInviteUrl: application?.discordInviteUrl || "",
      discordGuildId: application?.discordGuildId || null,
      discordGuildName: application?.discordGuildName || "",
      discordMemberCount: application?.discordMemberCount || 0,
      postsCount,
      followersCount: business.followersCount || 0,
      approvedAt: application?.reviewedAt || null,
      accountCreatedAt: business.createdAt,
      reason,
      deletedById: req.user.id,
      deletedByUsername: req.user.username || "",
    },
  });

  disconnectUser(business.id);
  disconnectStaffUser(business.id);

  await prisma.businessCollaborator.deleteMany({ where: { businessUserId: business.id } });
  await prisma.businessApplication.deleteMany({ where: { businessUserId: business.id } });

  const purged = await banAndDeleteAccount(business, {
    bannedBy: req.user.id,
    reason,
    banDiscord: false,
    keepProfileMedia: true,
  });

  await logStaffAction({
    staffId: req.user.id,
    action: "delete_business_account",
    targetType: "user",
    targetId: business.id,
    targetUser: business.businessOwnerId || undefined,
    targetLabel: `@${business.username}`,
    meta: {
      reason,
      snapshotId: snapshot.id,
      ownerUsername: business.businessOwner?.username || undefined,
      discordGuildId: application?.discordGuildId || undefined,
      collaborators: collaborators.length,
      purged: purged || undefined,
    },
  });

  res.json({
    ok: true,
    usernameFreed: business.username,
    snapshot: serializeDeletedBusiness(snapshot),
  });
}
