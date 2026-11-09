import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hashIp } from "../src/lib/ipHash.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(rootDir, ".env"), override: true });
dotenv.config({ path: path.join(rootDir, "server", ".env"), override: true });

const MONGODB_URI = (process.env.MONGODB_URI || "").trim();
const DATABASE_URL = (process.env.DATABASE_URL || "").trim();
const MONGO_DB_NAME = (process.env.MONGO_DB_NAME || "test").trim();

if (!/^mongodb(\+srv)?:\/\//.test(MONGODB_URI)) {
  throw new Error("Set MONGODB_URI to your Atlas connection string");
}
if (!/^postgres(ql)?:\/\//.test(DATABASE_URL)) {
  throw new Error("Set DATABASE_URL to your Postgres connection string");
}

console.log(`Mongo URI db hint: ${MONGODB_URI.replace(/\/\/.*@/, "//***:***@").split("?")[0]}`);
console.log(`Using Mongo database name: ${MONGO_DB_NAME}`);

function oid(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
}

function date(value) {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function loadAll(db, name) {
  const docs = await db.collection(name).find({}).toArray();
  console.log(`  ${name}: ${docs.length}`);
  return docs;
}

async function main() {
  console.log("Connecting to MongoDB Atlas…");
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.client.db(MONGO_DB_NAME);
  console.log(`Connected to Mongo DB: ${db.databaseName}`);

  console.log("Connecting to Postgres…");
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  await prisma.$connect();

  console.log("Loading Mongo collections…");
  const users = await loadAll(db, "users");
  const communities = await loadAll(db, "communities");
  const memberships = await loadAll(db, "communitymemberships");
  const posts = await loadAll(db, "posts");
  const stories = await loadAll(db, "stories");
  const storyViews = await loadAll(db, "storyviews");
  const conversations = await loadAll(db, "conversations");
  const messages = await loadAll(db, "messages");
  const follows = await loadAll(db, "follows");
  const likes = await loadAll(db, "likes");
  const bookmarks = await loadAll(db, "bookmarks");
  const blocks = await loadAll(db, "blocks");
  const mutes = await loadAll(db, "mutes");
  const notifications = await loadAll(db, "notifications");
  const pollVotes = await loadAll(db, "pollvotes");
  const notInterested = await loadAll(db, "notinteresteds");
  const reports = await loadAll(db, "reports");
  const suspensions = await loadAll(db, "suspensions");
  const bannedIps = await loadAll(db, "bannedips");
  const securityFlags = await loadAll(db, "securityflags");
  const auditLogs = await loadAll(db, "staffauditlogs");
  const staffApps = await loadAll(db, "staffapplications");
  const verApps = await loadAll(db, "verificationapplications");
  const copyrightReqs = await loadAll(db, "copyrightrequests");
  const analytics = await loadAll(db, "analyticsevents");
  const pendingUploads = await loadAll(db, "pendinguploads");
  const favoriteGifs = await loadAll(db, "favoritegifs");

  const BATCH = 500;

  async function createMany(label, rows, insert) {
    console.log(`Inserting ${label} (${rows.length})…`);
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await insert(chunk);
    }
  }

  await createMany("users", users, (chunk) =>
    prisma.user.createMany({
      data: chunk.map((u) => ({
        id: oid(u._id),
        discordId: u.discordId,
        discordUsername: u.discordUsername,
        username: u.username ?? null,
        usernameChangedAt: date(u.usernameChangedAt),
        previousUsernames: u.previousUsernames ?? [],
        displayName: u.displayName ?? "",
        bio: u.bio ?? "",
        avatarUrl: u.avatarUrl ?? "",
        bannerUrl: u.bannerUrl ?? "",
        isPrivate: !!u.isPrivate,
        hideFollowing: !!u.hideFollowing,
        hideProfileMedia: !!u.hideProfileMedia,
        restrictMessages: !!u.restrictMessages,
        isVerified: !!u.isVerified,
        verificationStatus: u.verificationStatus ?? "none",
        interests: u.interests ?? [],
        role: u.role ?? "user",
        badges: Array.isArray(u.badges) ? u.badges.map(String) : [],
        equippedBadges: Array.isArray(u.equippedBadges) ? u.equippedBadges.map(String) : [],
        tokenVersion: u.tokenVersion ?? 0,
        status: u.status ?? "active",
        suspendedUntil: date(u.suspendedUntil),
        suspendReason: u.suspendReason ?? null,
        onboardingComplete: !!u.onboardingComplete,
        hasSeenPromoVideo: !!u.hasSeenPromoVideo,
        lastActiveAt: date(u.lastActiveAt),
        accountKind: u.accountKind ?? "personal",
        professionalCommunityId: null,
        createdAt: date(u.createdAt) ?? new Date(),
        updatedAt: date(u.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  const userIds = new Set(users.map((u) => oid(u._id)));

  await createMany("communities", communities, (chunk) =>
    prisma.community.createMany({
      data: chunk.map((c) => {
        const ownerId = oid(c.ownerId);
        return {
          id: oid(c._id),
          name: c.name,
          slug: c.slug,
          previousSlugs: c.previousSlugs ?? [],
          description: c.description ?? "",
          logoUrl: c.logoUrl ?? "",
          inviteCode: c.inviteCode,
          joinPolicy: c.joinPolicy ?? "invite",
          isGlobal: !!c.isGlobal,
          ownerId: ownerId && userIds.has(ownerId) ? ownerId : null,
          memberCount: c.memberCount ?? 1,
          postCount: c.postCount ?? 0,
          verificationFollowerThreshold: c.verificationFollowerThreshold ?? 1000,
          verificationApplicationsOnly: c.verificationApplicationsOnly !== false,
          createdAt: date(c.createdAt) ?? new Date(),
          updatedAt: date(c.updatedAt) ?? new Date(),
        };
      }),
      skipDuplicates: true,
    })
  );

  const communityIds = new Set(communities.map((c) => oid(c._id)));

  const proLinks = users.filter((u) => {
    const communityId = oid(u.professionalCommunity);
    return communityId && communityIds.has(communityId);
  });
  for (const u of proLinks) {
    await prisma.user.update({
      where: { id: oid(u._id) },
      data: { professionalCommunityId: oid(u.professionalCommunity) },
    });
  }

  const validPosts = posts.filter((p) => userIds.has(oid(p.author)) && communityIds.has(oid(p.community)));
  const postIds = new Set(validPosts.map((p) => oid(p._id)));

  await createMany("posts", validPosts, (chunk) =>
    prisma.post.createMany({
      data: chunk.map((p) => ({
        id: oid(p._id),
        authorId: oid(p.author),
        communityId: oid(p.community),
        shortId: p.shortId ?? null,
        content: p.content ?? "",
        gifUrl: p.gifUrl ?? null,
        mediaUrl: p.mediaUrl ?? null,
        mediaType: p.mediaType ?? null,
        poll: p.poll ?? null,
        parentPostId: null,
        quotedPostId: null,
        repostOfId: null,
        likesCount: p.likesCount ?? 0,
        repostsCount: p.repostsCount ?? 0,
        commentsCount: p.commentsCount ?? 0,
        impressionsCount: p.impressionsCount ?? 0,
        deleted: !!p.deleted,
        editedAt: date(p.editedAt),
        moderationStatus: p.moderationStatus ?? "pending",
        moderationAttempts: p.moderationAttempts ?? 0,
        moderationTextClear: !!p.moderationTextClear,
        createdAt: date(p.createdAt) ?? new Date(),
        updatedAt: date(p.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  for (const p of validPosts) {
    const parentPostId = oid(p.parentPost);
    const quotedPostId = oid(p.quotedPost);
    const repostOfId = oid(p.repostOf);
    if (!parentPostId && !quotedPostId && !repostOfId) continue;
    await prisma.post.update({
      where: { id: oid(p._id) },
      data: {
        parentPostId: parentPostId && postIds.has(parentPostId) ? parentPostId : null,
        quotedPostId: quotedPostId && postIds.has(quotedPostId) ? quotedPostId : null,
        repostOfId: repostOfId && postIds.has(repostOfId) ? repostOfId : null,
      },
    });
  }

  const validMemberships = memberships.filter(
    (m) => userIds.has(oid(m.user)) && communityIds.has(oid(m.community))
  );
  await createMany("memberships", validMemberships, (chunk) =>
    prisma.communityMembership.createMany({
      data: chunk.map((m) => ({
        id: oid(m._id),
        communityId: oid(m.community),
        userId: oid(m.user),
        role: m.role ?? "member",
        status: m.status ?? "active",
        professionalCategory: m.professionalCategory ?? null,
        professionalReason: m.professionalReason ?? null,
        professionalStatus: m.professionalStatus ?? "none",
        professionalReviewedById: userIds.has(oid(m.professionalReviewedBy)) ? oid(m.professionalReviewedBy) : null,
        professionalReviewedAt: date(m.professionalReviewedAt),
        professionalProfileUserId: userIds.has(oid(m.professionalProfileUser)) ? oid(m.professionalProfileUser) : null,
        verificationStatus: m.verificationStatus ?? "none",
        verificationReason: m.verificationReason ?? null,
        verificationInvitedById: userIds.has(oid(m.verificationInvitedBy)) ? oid(m.verificationInvitedBy) : null,
        verificationReviewedById: userIds.has(oid(m.verificationReviewedBy)) ? oid(m.verificationReviewedBy) : null,
        verificationReviewedAt: date(m.verificationReviewedAt),
        followersCount: m.followersCount ?? 0,
        followingCount: m.followingCount ?? 0,
        postsCount: m.postsCount ?? 0,
        pinnedPostId: postIds.has(oid(m.pinnedPost)) ? oid(m.pinnedPost) : null,
        bannedReason: m.bannedReason ?? null,
        bannedById: userIds.has(oid(m.bannedBy)) ? oid(m.bannedBy) : null,
        bannedUntil: date(m.bannedUntil),
        createdAt: date(m.createdAt) ?? new Date(),
        updatedAt: date(m.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  const validStories = stories.filter((s) => userIds.has(oid(s.author)) && communityIds.has(oid(s.community)));
  const storyIds = new Set(validStories.map((s) => oid(s._id)));
  await createMany("stories", validStories, (chunk) =>
    prisma.story.createMany({
      data: chunk.map((s) => ({
        id: oid(s._id),
        authorId: oid(s.author),
        communityId: oid(s.community),
        mediaUrl: s.mediaUrl,
        mediaType: s.mediaType,
        caption: s.caption ?? "",
        expiresAt: date(s.expiresAt) ?? new Date(),
        createdAt: date(s.createdAt) ?? new Date(),
        updatedAt: date(s.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  await createMany(
    "storyViews",
    storyViews.filter((v) => storyIds.has(oid(v.story)) && userIds.has(oid(v.viewer))),
    (chunk) =>
      prisma.storyView.createMany({
        data: chunk.map((v) => ({
          id: oid(v._id),
          storyId: oid(v.story),
          viewerId: oid(v.viewer),
          expiresAt: date(v.expiresAt) ?? new Date(),
          createdAt: date(v.createdAt) ?? new Date(),
          updatedAt: date(v.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  const validConversations = conversations.filter(
    (c) => !oid(c.community) || communityIds.has(oid(c.community))
  );
  const conversationIds = new Set(validConversations.map((c) => oid(c._id)));
  await createMany("conversations", validConversations, (chunk) =>
    prisma.conversation.createMany({
      data: chunk.map((c) => ({
        id: oid(c._id),
        communityId: communityIds.has(oid(c.community)) ? oid(c.community) : null,
        lastMessageText: c.lastMessageText ?? "",
        lastMessageAt: date(c.lastMessageAt),
        isGroup: !!c.isGroup,
        name: c.name ?? "",
        iconUrl: c.iconUrl ?? "",
        createdById: userIds.has(oid(c.createdBy)) ? oid(c.createdBy) : null,
        createdAt: date(c.createdAt) ?? new Date(),
        updatedAt: date(c.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  const participants = [];
  for (const c of validConversations) {
    for (const p of c.participants || []) {
      const userId = oid(p);
      if (!userIds.has(userId)) continue;
      participants.push({ conversationId: oid(c._id), userId });
    }
  }
  await createMany("conversationParticipants", participants, (chunk) =>
    prisma.conversationParticipant.createMany({ data: chunk, skipDuplicates: true })
  );

  const validMessages = messages.filter(
    (m) => conversationIds.has(oid(m.conversation)) && userIds.has(oid(m.sender))
  );
  const messageIds = new Set(validMessages.map((m) => oid(m._id)));
  await createMany("messages", validMessages, (chunk) =>
    prisma.message.createMany({
      data: chunk.map((m) => ({
        id: oid(m._id),
        conversationId: oid(m.conversation),
        senderId: oid(m.sender),
        content: m.content ?? "",
        sharedPostId: postIds.has(oid(m.sharedPost)) ? oid(m.sharedPost) : null,
        sharedStoryId: storyIds.has(oid(m.sharedStory)) ? oid(m.sharedStory) : null,
        mediaUrl: m.mediaUrl ?? null,
        gifUrl: m.gifUrl ?? null,
        editedAt: date(m.editedAt),
        moderationState: m.moderationState ?? "clear",
        moderationReason: m.moderationReason ?? null,
        deletedAt: date(m.deletedAt),
        createdAt: date(m.createdAt) ?? new Date(),
        updatedAt: date(m.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  const deliveries = [];
  const reads = [];
  const reactions = [];
  for (const m of validMessages) {
    for (const u of m.deliveredTo || []) {
      const userId = oid(u);
      if (userIds.has(userId)) deliveries.push({ messageId: oid(m._id), userId });
    }
    for (const u of m.readBy || []) {
      const userId = oid(u);
      if (userIds.has(userId)) reads.push({ messageId: oid(m._id), userId });
    }
    for (const r of m.reactions || []) {
      if (!r?.user || !r?.emoji) continue;
      const userId = oid(r.user);
      if (userIds.has(userId)) reactions.push({ messageId: oid(m._id), userId, emoji: r.emoji });
    }
  }
  await createMany("messageDeliveries", deliveries, (chunk) =>
    prisma.messageDelivery.createMany({ data: chunk, skipDuplicates: true })
  );
  await createMany("messageReads", reads, (chunk) =>
    prisma.messageRead.createMany({ data: chunk, skipDuplicates: true })
  );
  await createMany("messageReactions", reactions, (chunk) =>
    prisma.messageReaction.createMany({ data: chunk, skipDuplicates: true })
  );

  await createMany(
    "follows",
    follows.filter(
      (f) =>
        userIds.has(oid(f.follower)) &&
        userIds.has(oid(f.following)) &&
        communityIds.has(oid(f.community))
    ),
    (chunk) =>
      prisma.follow.createMany({
        data: chunk.map((f) => ({
          id: oid(f._id),
          followerId: oid(f.follower),
          followingId: oid(f.following),
          communityId: oid(f.community),
          status: f.status ?? "accepted",
          createdAt: date(f.createdAt) ?? new Date(),
          updatedAt: date(f.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "likes",
    likes.filter(
      (l) => userIds.has(oid(l.user)) && postIds.has(oid(l.post)) && communityIds.has(oid(l.community))
    ),
    (chunk) =>
      prisma.like.createMany({
        data: chunk.map((l) => ({
          id: oid(l._id),
          userId: oid(l.user),
          postId: oid(l.post),
          communityId: oid(l.community),
          createdAt: date(l.createdAt) ?? new Date(),
          updatedAt: date(l.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "bookmarks",
    bookmarks.filter(
      (b) => userIds.has(oid(b.user)) && postIds.has(oid(b.post)) && communityIds.has(oid(b.community))
    ),
    (chunk) =>
      prisma.bookmark.createMany({
        data: chunk.map((b) => ({
          id: oid(b._id),
          userId: oid(b.user),
          postId: oid(b.post),
          communityId: oid(b.community),
          createdAt: date(b.createdAt) ?? new Date(),
          updatedAt: date(b.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "blocks",
    blocks.filter(
      (b) =>
        userIds.has(oid(b.blocker)) &&
        userIds.has(oid(b.blocked)) &&
        communityIds.has(oid(b.community))
    ),
    (chunk) =>
      prisma.block.createMany({
        data: chunk.map((b) => ({
          id: oid(b._id),
          blockerId: oid(b.blocker),
          blockedId: oid(b.blocked),
          communityId: oid(b.community),
          createdAt: date(b.createdAt) ?? new Date(),
          updatedAt: date(b.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "mutes",
    mutes.filter(
      (m) => userIds.has(oid(m.muter)) && userIds.has(oid(m.muted)) && communityIds.has(oid(m.community))
    ),
    (chunk) =>
      prisma.mute.createMany({
        data: chunk.map((m) => ({
          id: oid(m._id),
          muterId: oid(m.muter),
          mutedId: oid(m.muted),
          communityId: oid(m.community),
          createdAt: date(m.createdAt) ?? new Date(),
          updatedAt: date(m.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "notifications",
    notifications.filter((n) => userIds.has(oid(n.recipient)) && userIds.has(oid(n.actor))),
    (chunk) =>
      prisma.notification.createMany({
        data: chunk.map((n) => ({
          id: oid(n._id),
          recipientId: oid(n.recipient),
          actorId: oid(n.actor),
          type: n.type,
          postId: postIds.has(oid(n.post)) ? oid(n.post) : null,
          communityId: communityIds.has(oid(n.community)) ? oid(n.community) : null,
          read: !!n.read,
          createdAt: date(n.createdAt) ?? new Date(),
          updatedAt: date(n.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "pollVotes",
    pollVotes.filter(
      (v) => userIds.has(oid(v.user)) && postIds.has(oid(v.post)) && communityIds.has(oid(v.community))
    ),
    (chunk) =>
      prisma.pollVote.createMany({
        data: chunk.map((v) => ({
          id: oid(v._id),
          userId: oid(v.user),
          postId: oid(v.post),
          communityId: oid(v.community),
          optionIndex: v.optionIndex,
          createdAt: date(v.createdAt) ?? new Date(),
          updatedAt: date(v.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "notInterested",
    notInterested.filter(
      (n) => userIds.has(oid(n.user)) && postIds.has(oid(n.post)) && communityIds.has(oid(n.community))
    ),
    (chunk) =>
      prisma.notInterested.createMany({
        data: chunk.map((n) => ({
          id: oid(n._id),
          userId: oid(n.user),
          postId: oid(n.post),
          communityId: oid(n.community),
          createdAt: date(n.createdAt) ?? new Date(),
          updatedAt: date(n.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "reports",
    reports.filter((r) => communityIds.has(oid(r.community))),
    (chunk) =>
      prisma.report.createMany({
        data: chunk.map((r) => ({
          id: oid(r._id),
          reporterId: userIds.has(oid(r.reporter)) ? oid(r.reporter) : null,
          source: r.source ?? "user",
          communityId: oid(r.community),
          targetType: r.targetType,
          targetId: oid(r.targetId),
          contentSnapshot: r.contentSnapshot ?? null,
          reason: r.reason,
          details: r.details ?? "",
          status: r.status ?? "pending",
          actionTaken: r.actionTaken ?? "",
          reviewedById: userIds.has(oid(r.reviewedBy)) ? oid(r.reviewedBy) : null,
          reviewedAt: date(r.reviewedAt),
          createdAt: date(r.createdAt) ?? new Date(),
          updatedAt: date(r.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "suspensions",
    suspensions.filter((s) => userIds.has(oid(s.user)) && userIds.has(oid(s.issuedBy))),
    (chunk) =>
      prisma.suspension.createMany({
        data: chunk.map((s) => ({
          id: oid(s._id),
          userId: oid(s.user),
          issuedById: oid(s.issuedBy),
          kind: s.kind,
          reason: s.reason,
          until: date(s.until),
          active: s.active !== false,
          liftedAt: date(s.liftedAt),
          liftedById: userIds.has(oid(s.liftedBy)) ? oid(s.liftedBy) : null,
          createdAt: date(s.createdAt) ?? new Date(),
          updatedAt: date(s.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany("bannedIps", bannedIps, (chunk) =>
    prisma.bannedIp.createMany({
      data: chunk.map((b) => ({
        id: oid(b._id),
        ipHash: hashIp(b.ip),
        reason: b.reason ?? "",
        bannedById: userIds.has(oid(b.bannedBy)) ? oid(b.bannedBy) : null,
        expiresAt: date(b.expiresAt),
        createdAt: date(b.createdAt) ?? new Date(),
        updatedAt: date(b.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  await createMany("securityFlags", securityFlags, (chunk) =>
    prisma.securityFlag.createMany({
      data: chunk.map((f) => ({
        id: oid(f._id),
        type: f.type,
        ipHash: hashIp(f.ip) || null,
        userAgent: f.userAgent ?? null,
        method: f.method ?? null,
        path: f.path ?? null,
        userId: userIds.has(oid(f.user)) ? oid(f.user) : null,
        meta: f.meta ?? null,
        createdAt: date(f.createdAt) ?? new Date(),
        updatedAt: date(f.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  await createMany(
    "staffAuditLogs",
    auditLogs.filter((a) => userIds.has(oid(a.staff))),
    (chunk) =>
      prisma.staffAuditLog.createMany({
        data: chunk.map((a) => ({
          id: oid(a._id),
          staffId: oid(a.staff),
          action: a.action,
          targetType: a.targetType,
          targetId: oid(a.targetId),
          targetUserId: userIds.has(oid(a.targetUser)) ? oid(a.targetUser) : null,
          targetLabel: a.targetLabel ?? "",
          communityId: communityIds.has(oid(a.community)) ? oid(a.community) : null,
          meta: a.meta ?? null,
          createdAt: date(a.createdAt) ?? new Date(),
          updatedAt: date(a.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany("staffApplications", staffApps, (chunk) =>
    prisma.staffApplication.createMany({
      data: chunk.map((a) => ({
        id: oid(a._id),
        discordId: a.discordId,
        discordUsername: a.discordUsername,
        position: a.position,
        department: a.department ?? null,
        motivation: a.motivation,
        experience: a.experience ?? "",
        scenarioResponses: a.scenarioResponses ?? [],
        tosAgreed: !!a.tosAgreed,
        status: a.status ?? "pending",
        staffNote: a.staffNote ?? "",
        reviewedById: userIds.has(oid(a.reviewedBy)) ? oid(a.reviewedBy) : null,
        reviewedAt: date(a.reviewedAt),
        createdAt: date(a.createdAt) ?? new Date(),
        updatedAt: date(a.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  await createMany(
    "verificationApplications",
    verApps.filter((a) => userIds.has(oid(a.user))),
    (chunk) =>
      prisma.verificationApplication.createMany({
        data: chunk.map((a) => ({
          id: oid(a._id),
          userId: oid(a.user),
          reason: a.reason,
          status: a.status ?? "pending",
          reviewedById: userIds.has(oid(a.reviewedBy)) ? oid(a.reviewedBy) : null,
          reviewedAt: date(a.reviewedAt),
          createdAt: date(a.createdAt) ?? new Date(),
          updatedAt: date(a.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany("copyrightRequests", copyrightReqs, (chunk) =>
    prisma.copyrightRequest.createMany({
      data: chunk.map((c) => ({
        id: oid(c._id),
        requesterName: c.requesterName,
        requesterEmail: c.requesterEmail,
        copyrightedWork: c.copyrightedWork,
        infringingUrls: c.infringingUrls ?? [],
        details: c.details ?? "",
        goodFaithConfirmed: !!c.goodFaithConfirmed,
        accuracyConfirmed: !!c.accuracyConfirmed,
        signature: c.signature,
        status: c.status ?? "pending",
        staffNote: c.staffNote ?? "",
        reviewedById: userIds.has(oid(c.reviewedBy)) ? oid(c.reviewedBy) : null,
        reviewedAt: date(c.reviewedAt),
        createdAt: date(c.createdAt) ?? new Date(),
        updatedAt: date(c.updatedAt) ?? new Date(),
      })),
      skipDuplicates: true,
    })
  );

  await createMany(
    "analyticsEvents",
    analytics.filter((e) => userIds.has(oid(e.targetUser)) && communityIds.has(oid(e.community))),
    (chunk) =>
      prisma.analyticsEvent.createMany({
        data: chunk.map((e) => ({
          id: oid(e._id),
          targetUserId: oid(e.targetUser),
          communityId: oid(e.community),
          type: e.type,
          postId: postIds.has(oid(e.post)) ? oid(e.post) : null,
          viewerId: userIds.has(oid(e.viewer)) ? oid(e.viewer) : null,
          createdAt: date(e.createdAt) ?? new Date(),
          updatedAt: date(e.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "pendingUploads",
    pendingUploads.filter((p) => userIds.has(oid(p.user))),
    (chunk) =>
      prisma.pendingUpload.createMany({
        data: chunk.map((p) => ({
          id: oid(p._id),
          userId: oid(p.user),
          url: p.url,
          createdAt: date(p.createdAt) ?? new Date(),
          updatedAt: date(p.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  await createMany(
    "favoriteGifs",
    favoriteGifs.filter((g) => userIds.has(oid(g.user))),
    (chunk) =>
      prisma.favoriteGif.createMany({
        data: chunk.map((g) => ({
          id: oid(g._id),
          userId: oid(g.user),
          gifId: g.gifId,
          url: g.url,
          previewUrl: g.previewUrl,
          description: g.description ?? "",
          createdAt: date(g.createdAt) ?? new Date(),
          updatedAt: date(g.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
  );

  let bannedDiscordIds = [];
  try {
    bannedDiscordIds = await loadAll(db, "banneddiscordids");
  } catch {
    console.log("  banneddiscordids: (missing, skipping)");
  }
  if (bannedDiscordIds.length) {
    await createMany("bannedDiscordIds", bannedDiscordIds, (chunk) =>
      prisma.bannedDiscordId.createMany({
        data: chunk.map((b) => ({
          id: oid(b._id),
          discordId: String(b.discordId),
          reason: b.reason ?? "",
          bannedById: b.bannedBy && userIds.has(oid(b.bannedBy)) ? oid(b.bannedBy) : null,
          createdAt: date(b.createdAt) ?? new Date(),
          updatedAt: date(b.updatedAt) ?? new Date(),
        })),
        skipDuplicates: true,
      })
    );
  }

  console.log("Migration complete.");
  await prisma.$disconnect();
  await pool.end();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  try {
    await mongoose.disconnect();
  } catch {}
});
