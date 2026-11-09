import { prisma } from "../db/prisma.js";
import { effectiveRole } from "../config/roles.js";
import { usernameChangeAvailableAt } from "./username.js";

export const POST_INCLUDE = {
  author: true,
  quotedPost: { include: { author: true } },
  repostOf: {
    include: {
      author: true,
      quotedPost: { include: { author: true } },
    },
  },
};

export const POST_INCLUDE_WITH_PARENT = {
  ...POST_INCLUDE,
  parentPost: { include: { author: true } },
};

export function serializeUser(user, flags = {}, membership = null) {
  if (!user || !user.id) return null;
  const hideMedia = user.hideProfileMedia && !flags.isSelf;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username || user.discordUsername,
    bio: user.bio,
    avatarUrl: hideMedia ? "" : user.avatarUrl,
    bannerUrl: hideMedia ? "" : user.bannerUrl,
    isPrivate: user.isPrivate,
    hideFollowing: user.hideFollowing,
    hideProfileMedia: user.hideProfileMedia,
    restrictMessages: user.restrictMessages,
    isVerified: user.isVerified,
    verificationStatus: user.verificationStatus,
    interests: user.interests,
    role: effectiveRole(user),
    badges: user.badges || [],
    equippedBadges: user.equippedBadges || [],
    status: user.status,
    suspendedUntil: flags.isSelf ? user.suspendedUntil || null : undefined,
    suspendReason: flags.isSelf ? user.suspendReason || null : undefined,
    usernameChangeAvailableAt: flags.isSelf ? usernameChangeAvailableAt(user) : undefined,
    onboardingComplete: user.onboardingComplete,
    hasSeenPromoVideo: user.hasSeenPromoVideo,
    accountKind: user.accountKind,
    accountLabel: user.accountLabel || "",
    isBusinessOwner: flags.isBusinessOwner,
    communityRole: membership?.role,
    professionalCategory: membership?.professionalCategory || null,
    professionalStatus: membership?.professionalStatus || "none",
    communityVerificationStatus: membership?.verificationStatus || "none",
    followersCount: user.followersCount || 0,
    followingCount: user.followingCount || 0,
    postsCount: membership?.postsCount || 0,
    pinnedPostId: membership?.pinnedPostId || null,
    discordUsername: flags.isSelf ? user.discordUsername : undefined,
    isFollowedByMe: flags.followStatus === "accepted",
    followStatus: flags.followStatus || null,
    isFollowingMe: !!flags.isFollowingMe,
    isBlockedByMe: !!flags.isBlockedByMe,
    isMutedByMe: !!flags.isMutedByMe,
    createdAt: user.createdAt,
  };
}

function serializePoll(poll, myVote) {
  if (!poll) return undefined;
  const options = poll.options || [];
  const totalVotes = options.reduce((sum, o) => sum + (o.votesCount || 0), 0);
  const expiresAt = poll.expiresAt ? new Date(poll.expiresAt) : null;
  return {
    options: options.map((o) => ({ text: o.text, votesCount: o.votesCount || 0 })),
    imageUrl: poll.imageUrl || undefined,
    totalVotes,
    expiresAt,
    isExpired: expiresAt ? expiresAt.getTime() <= Date.now() : false,
    myVote: myVote ?? null,
  };
}

function serializePostBase(post, author, flags, quotedDto, repostOfDto, inReplyToDto) {
  return {
    id: post.id,
    shortId: post.shortId || undefined,
    community: post.communityId || undefined,
    author,
    content: post.content,
    gifUrl: post.gifUrl || undefined,
    mediaUrl: post.mediaUrl || undefined,
    mediaType: post.mediaType || undefined,
    poll: serializePoll(post.poll, flags.myVote),
    editedAt: post.editedAt || undefined,
    deleted: !!post.deleted,
    parentPost: post.parentPostId || undefined,
    inReplyTo: inReplyToDto || null,
    quotedPost: quotedDto || null,
    repostOf: repostOfDto || null,
    likesCount: post.likesCount,
    repostsCount: post.repostsCount,
    commentsCount: post.commentsCount,
    impressionsCount: post.impressionsCount,
    isLikedByMe: !!flags.isLikedByMe,
    isRepostedByMe: !!flags.isRepostedByMe,
    isBookmarkedByMe: !!flags.isBookmarkedByMe,
    createdAt: post.createdAt,
  };
}

async function buildViewerContext(viewerId, authorIds, postIds, communityId) {
  if (!viewerId) {
    return {
      viewerId: null,
      follows: new Map(),
      followedBy: new Set(),
      blocks: new Set(),
      mutes: new Set(),
      likes: new Set(),
      reposts: new Set(),
      bookmarks: new Set(),
      pollVotes: new Map(),
      memberships: new Map(),
    };
  }

  const [followDocs, followedByDocs, blockDocs, muteDocs, likeDocs, repostDocs, bookmarkDocs, pollVoteDocs, membershipDocs] =
    await Promise.all([
      prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: authorIds } },
        select: { followingId: true, status: true },
      }),
      prisma.follow.findMany({
        where: {
          followerId: { in: authorIds },
          followingId: viewerId,
          status: "accepted",
        },
        select: { followerId: true },
      }),
      prisma.block.findMany({
        where: { blockerId: viewerId, blockedId: { in: authorIds } },
        select: { blockedId: true },
      }),
      prisma.mute.findMany({
        where: { muterId: viewerId, mutedId: { in: authorIds } },
        select: { mutedId: true },
      }),
      prisma.like.findMany({
        where: { userId: viewerId, postId: { in: postIds }, communityId },
        select: { postId: true },
      }),
      prisma.post.findMany({
        where: { authorId: viewerId, repostOfId: { in: postIds }, communityId },
        select: { repostOfId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId: viewerId, postId: { in: postIds }, communityId },
        select: { postId: true },
      }),
      prisma.pollVote.findMany({
        where: { userId: viewerId, postId: { in: postIds }, communityId },
        select: { postId: true, optionIndex: true },
      }),
      prisma.communityMembership.findMany({
        where: { communityId, userId: { in: [...authorIds, viewerId] } },
      }),
    ]);

  return {
    viewerId,
    follows: new Map(followDocs.map((f) => [f.followingId, f.status])),
    followedBy: new Set(followedByDocs.map((f) => f.followerId)),
    blocks: new Set(blockDocs.map((b) => b.blockedId)),
    mutes: new Set(muteDocs.map((m) => m.mutedId)),
    likes: new Set(likeDocs.map((l) => l.postId)),
    reposts: new Set(repostDocs.map((r) => r.repostOfId).filter(Boolean)),
    bookmarks: new Set(bookmarkDocs.map((b) => b.postId)),
    pollVotes: new Map(pollVoteDocs.map((v) => [v.postId, v.optionIndex])),
    memberships: new Map(membershipDocs.map((m) => [m.userId, m])),
  };
}

function collectIds(posts) {
  const authorIds = new Set();
  const postIds = new Set();

  for (const p of posts) {
    if (!p?.id) continue;
    postIds.add(p.id);
    if (p.author?.id) authorIds.add(p.author.id);
    if (p.quotedPost?.id) {
      postIds.add(p.quotedPost.id);
      if (p.quotedPost.author?.id) authorIds.add(p.quotedPost.author.id);
    }
    if (p.repostOf?.id) {
      postIds.add(p.repostOf.id);
      if (p.repostOf.author?.id) authorIds.add(p.repostOf.author.id);
      if (p.repostOf.quotedPost?.id) {
        postIds.add(p.repostOf.quotedPost.id);
        if (p.repostOf.quotedPost.author?.id) authorIds.add(p.repostOf.quotedPost.author.id);
      }
    }
    if (p.parentPost?.id) {
      postIds.add(p.parentPost.id);
      if (p.parentPost.author?.id) authorIds.add(p.parentPost.author.id);
    }
  }

  return { authorIds: [...authorIds], postIds: [...postIds] };
}

function isPopulatedPost(ref) {
  return !!ref && typeof ref === "object" && !!ref.author?.id;
}

function dtoFor(post, ctx) {
  if (!isPopulatedPost(post)) return null;
  const authorId = post.author.id;
  const author = serializeUser(
    post.author,
    {
      followStatus: ctx.follows.get(authorId),
      isFollowingMe: ctx.followedBy.has(authorId),
      isBlockedByMe: ctx.blocks.has(authorId),
      isMutedByMe: ctx.mutes.has(authorId),
      isSelf: authorId === ctx.viewerId,
    },
    ctx.memberships.get(authorId)
  );

  const originalId = post.repostOf?.id || post.id;
  const quotedDto = isPopulatedPost(post.quotedPost) ? dtoFor(post.quotedPost, ctx) : null;
  const repostOfDto = isPopulatedPost(post.repostOf) ? dtoFor(post.repostOf, ctx) : null;
  const inReplyToDto = isPopulatedPost(post.parentPost) ? dtoFor(post.parentPost, ctx) : null;

  return serializePostBase(
    post,
    author,
    {
      isLikedByMe: ctx.likes.has(originalId),
      isRepostedByMe: ctx.reposts.has(originalId),
      isBookmarkedByMe: ctx.bookmarks.has(originalId),
      myVote: ctx.pollVotes.get(post.id),
    },
    quotedDto,
    repostOfDto,
    inReplyToDto
  );
}

export async function hydratePosts(posts, viewerId, communityId) {
  const { authorIds, postIds } = collectIds(posts);
  const ctx = await buildViewerContext(viewerId, authorIds, postIds, communityId);
  return posts.map((p) => dtoFor(p, ctx)).filter(Boolean);
}

export async function hydratePost(post, viewerId, communityId) {
  const [dto] = await hydratePosts([post], viewerId, communityId);
  return dto;
}

export async function hydrateUsers(users, viewerId, communityId) {
  if (!users.length) return [];
  if (!viewerId) return users.map((user) => serializeUser(user, {}));
  if (!communityId) {
    return users.map((user) => serializeUser(user, { isSelf: user.id === viewerId }));
  }

  const ctx = await buildViewerContext(
    viewerId,
    users.map((user) => user.id),
    [],
    communityId
  );
  return users.map((user) => {
    const id = user.id;
    return serializeUser(
      user,
      {
        followStatus: ctx.follows.get(id),
        isFollowingMe: ctx.followedBy.has(id),
        isBlockedByMe: ctx.blocks.has(id),
        isMutedByMe: ctx.mutes.has(id),
        isSelf: id === viewerId,
      },
      ctx.memberships.get(id)
    );
  });
}

export async function hydrateUser(user, viewerId, communityId) {
  const [dto] = await hydrateUsers([user], viewerId, communityId);
  return dto;
}
