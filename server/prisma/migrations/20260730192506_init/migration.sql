CREATE TABLE "User" (
    "id" CHAR(24) NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "username" TEXT,
    "usernameChangedAt" TIMESTAMP(3),
    "previousUsernames" JSONB NOT NULL DEFAULT '[]',
    "displayName" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "bannerUrl" TEXT NOT NULL DEFAULT '',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "hideFollowing" BOOLEAN NOT NULL DEFAULT false,
    "hideProfileMedia" BOOLEAN NOT NULL DEFAULT false,
    "restrictMessages" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'none',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" TEXT NOT NULL DEFAULT 'user',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "suspendedUntil" TIMESTAMP(3),
    "suspendReason" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenPromoVideo" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3),
    "accountKind" TEXT NOT NULL DEFAULT 'personal',
    "professionalCommunityId" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Community" (
    "id" CHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "inviteCode" TEXT NOT NULL,
    "joinPolicy" TEXT NOT NULL DEFAULT 'invite',
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" CHAR(24),
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "verificationFollowerThreshold" INTEGER NOT NULL DEFAULT 1000,
    "verificationApplicationsOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityMembership" (
    "id" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "professionalCategory" TEXT,
    "professionalReason" TEXT,
    "professionalStatus" TEXT NOT NULL DEFAULT 'none',
    "professionalReviewedById" CHAR(24),
    "professionalReviewedAt" TIMESTAMP(3),
    "professionalProfileUserId" CHAR(24),
    "verificationStatus" TEXT NOT NULL DEFAULT 'none',
    "verificationReason" TEXT,
    "verificationInvitedById" CHAR(24),
    "verificationReviewedById" CHAR(24),
    "verificationReviewedAt" TIMESTAMP(3),
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "pinnedPostId" CHAR(24),
    "bannedReason" TEXT,
    "bannedById" CHAR(24),
    "bannedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" CHAR(24) NOT NULL,
    "authorId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "shortId" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "gifUrl" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "poll" JSONB,
    "parentPostId" CHAR(24),
    "quotedPostId" CHAR(24),
    "repostOfId" CHAR(24),
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "repostsCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "impressionsCount" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "moderationStatus" TEXT NOT NULL DEFAULT 'pending',
    "moderationAttempts" INTEGER NOT NULL DEFAULT 0,
    "moderationTextClear" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Story" (
    "id" CHAR(24) NOT NULL,
    "authorId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoryView" (
    "id" CHAR(24) NOT NULL,
    "storyId" CHAR(24) NOT NULL,
    "viewerId" CHAR(24) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Conversation" (
    "id" CHAR(24) NOT NULL,
    "communityId" CHAR(24),
    "lastMessageText" TEXT NOT NULL DEFAULT '',
    "lastMessageAt" TIMESTAMP(3),
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT '',
    "iconUrl" TEXT NOT NULL DEFAULT '',
    "createdById" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" CHAR(24) NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "senderId" CHAR(24) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "sharedPostId" CHAR(24),
    "sharedStoryId" CHAR(24),
    "mediaUrl" TEXT,
    "gifUrl" TEXT,
    "editedAt" TIMESTAMP(3),
    "moderationState" TEXT NOT NULL DEFAULT 'clear',
    "moderationReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageRead" (
    "id" TEXT NOT NULL,
    "messageId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,

    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Follow" (
    "id" CHAR(24) NOT NULL,
    "followerId" CHAR(24) NOT NULL,
    "followingId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Like" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "postId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Bookmark" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "postId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Block" (
    "id" CHAR(24) NOT NULL,
    "blockerId" CHAR(24) NOT NULL,
    "blockedId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Mute" (
    "id" CHAR(24) NOT NULL,
    "muterId" CHAR(24) NOT NULL,
    "mutedId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" CHAR(24) NOT NULL,
    "recipientId" CHAR(24) NOT NULL,
    "actorId" CHAR(24) NOT NULL,
    "type" TEXT NOT NULL,
    "postId" CHAR(24),
    "communityId" CHAR(24),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollVote" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "postId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotInterested" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "postId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotInterested_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Report" (
    "id" CHAR(24) NOT NULL,
    "reporterId" CHAR(24),
    "source" TEXT NOT NULL DEFAULT 'user',
    "communityId" CHAR(24) NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" CHAR(24) NOT NULL,
    "contentSnapshot" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actionTaken" TEXT NOT NULL DEFAULT '',
    "reviewedById" CHAR(24),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Suspension" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "issuedById" CHAR(24) NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "liftedAt" TIMESTAMP(3),
    "liftedById" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BannedIp" (
    "id" CHAR(24) NOT NULL,
    "ip" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "bannedById" CHAR(24),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannedIp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityFlag" (
    "id" CHAR(24) NOT NULL,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "method" TEXT,
    "path" TEXT,
    "userId" CHAR(24),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAuditLog" (
    "id" CHAR(24) NOT NULL,
    "staffId" CHAR(24) NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" CHAR(24) NOT NULL,
    "targetUserId" CHAR(24),
    "targetLabel" TEXT NOT NULL DEFAULT '',
    "communityId" CHAR(24),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffApplication" (
    "id" CHAR(24) NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT,
    "motivation" TEXT NOT NULL,
    "experience" TEXT NOT NULL DEFAULT '',
    "scenarioResponses" JSONB NOT NULL DEFAULT '[]',
    "tosAgreed" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "staffNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" CHAR(24),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationApplication" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" CHAR(24),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CopyrightRequest" (
    "id" CHAR(24) NOT NULL,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "copyrightedWork" TEXT NOT NULL,
    "infringingUrls" TEXT[],
    "details" TEXT NOT NULL DEFAULT '',
    "goodFaithConfirmed" BOOLEAN NOT NULL,
    "accuracyConfirmed" BOOLEAN NOT NULL,
    "signature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "staffNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" CHAR(24),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyrightRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
    "id" CHAR(24) NOT NULL,
    "targetUserId" CHAR(24) NOT NULL,
    "communityId" CHAR(24) NOT NULL,
    "type" TEXT NOT NULL,
    "postId" CHAR(24),
    "viewerId" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PendingUpload" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TypingStatus" (
    "id" TEXT NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TypingStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FavoriteGif" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "gifId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteGif_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE INDEX "User_discordId_idx" ON "User"("discordId");

CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

CREATE INDEX "User_avatarUrl_idx" ON "User"("avatarUrl");

CREATE INDEX "User_bannerUrl_idx" ON "User"("bannerUrl");

CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

CREATE UNIQUE INDEX "Community_inviteCode_key" ON "Community"("inviteCode");

CREATE INDEX "Community_joinPolicy_memberCount_idx" ON "Community"("joinPolicy", "memberCount" DESC);

CREATE INDEX "Community_logoUrl_idx" ON "Community"("logoUrl");

CREATE INDEX "CommunityMembership_communityId_status_idx" ON "CommunityMembership"("communityId", "status");

CREATE INDEX "CommunityMembership_userId_status_idx" ON "CommunityMembership"("userId", "status");

CREATE INDEX "CommunityMembership_communityId_professionalStatus_updatedA_idx" ON "CommunityMembership"("communityId", "professionalStatus", "updatedAt");

CREATE INDEX "CommunityMembership_communityId_verificationStatus_updatedA_idx" ON "CommunityMembership"("communityId", "verificationStatus", "updatedAt");

CREATE UNIQUE INDEX "CommunityMembership_communityId_userId_key" ON "CommunityMembership"("communityId", "userId");

CREATE UNIQUE INDEX "Post_shortId_key" ON "Post"("shortId");

CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt" DESC);

CREATE INDEX "Post_parentPostId_deleted_createdAt_idx" ON "Post"("parentPostId", "deleted", "createdAt");

CREATE INDEX "Post_moderationStatus_deleted_createdAt_idx" ON "Post"("moderationStatus", "deleted", "createdAt");

CREATE INDEX "Post_communityId_createdAt_idx" ON "Post"("communityId", "createdAt" DESC);

CREATE INDEX "Post_mediaUrl_idx" ON "Post"("mediaUrl");

CREATE INDEX "Story_authorId_createdAt_idx" ON "Story"("authorId", "createdAt");

CREATE INDEX "Story_communityId_createdAt_idx" ON "Story"("communityId", "createdAt");

CREATE INDEX "Story_communityId_authorId_expiresAt_idx" ON "Story"("communityId", "authorId", "expiresAt");

CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");

CREATE INDEX "Story_mediaUrl_idx" ON "Story"("mediaUrl");

CREATE INDEX "StoryView_expiresAt_idx" ON "StoryView"("expiresAt");

CREATE UNIQUE INDEX "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");

CREATE INDEX "Conversation_communityId_lastMessageAt_idx" ON "Conversation"("communityId", "lastMessageAt" DESC);

CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt" DESC);

CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);

CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

CREATE INDEX "Message_mediaUrl_idx" ON "Message"("mediaUrl");

CREATE INDEX "Message_moderationState_createdAt_idx" ON "Message"("moderationState", "createdAt");

CREATE INDEX "MessageDelivery_userId_idx" ON "MessageDelivery"("userId");

CREATE UNIQUE INDEX "MessageDelivery_messageId_userId_key" ON "MessageDelivery"("messageId", "userId");

CREATE INDEX "MessageRead_userId_idx" ON "MessageRead"("userId");

CREATE UNIQUE INDEX "MessageRead_messageId_userId_key" ON "MessageRead"("messageId", "userId");

CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

CREATE INDEX "Follow_communityId_followingId_idx" ON "Follow"("communityId", "followingId");

CREATE INDEX "Follow_followerId_communityId_status_idx" ON "Follow"("followerId", "communityId", "status");

CREATE INDEX "Follow_followingId_communityId_status_createdAt_idx" ON "Follow"("followingId", "communityId", "status", "createdAt" DESC);

CREATE UNIQUE INDEX "Follow_followerId_followingId_communityId_key" ON "Follow"("followerId", "followingId", "communityId");

CREATE INDEX "Like_communityId_userId_idx" ON "Like"("communityId", "userId");

CREATE INDEX "Like_postId_idx" ON "Like"("postId");

CREATE UNIQUE INDEX "Like_userId_postId_key" ON "Like"("userId", "postId");

CREATE INDEX "Bookmark_userId_communityId_createdAt_idx" ON "Bookmark"("userId", "communityId", "createdAt" DESC);

CREATE UNIQUE INDEX "Bookmark_userId_postId_key" ON "Bookmark"("userId", "postId");

CREATE INDEX "Block_blockedId_communityId_idx" ON "Block"("blockedId", "communityId");

CREATE INDEX "Block_blockerId_communityId_createdAt_idx" ON "Block"("blockerId", "communityId", "createdAt" DESC);

CREATE UNIQUE INDEX "Block_blockerId_blockedId_communityId_key" ON "Block"("blockerId", "blockedId", "communityId");

CREATE UNIQUE INDEX "Mute_muterId_mutedId_communityId_key" ON "Mute"("muterId", "mutedId", "communityId");

CREATE INDEX "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt" DESC);

CREATE INDEX "Notification_recipientId_communityId_read_idx" ON "Notification"("recipientId", "communityId", "read");

CREATE UNIQUE INDEX "PollVote_userId_postId_key" ON "PollVote"("userId", "postId");

CREATE INDEX "NotInterested_communityId_userId_idx" ON "NotInterested"("communityId", "userId");

CREATE UNIQUE INDEX "NotInterested_userId_postId_key" ON "NotInterested"("userId", "postId");

CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt" DESC);

CREATE INDEX "Report_communityId_status_createdAt_idx" ON "Report"("communityId", "status", "createdAt" DESC);

CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

CREATE INDEX "Suspension_userId_active_idx" ON "Suspension"("userId", "active");

CREATE INDEX "Suspension_userId_createdAt_idx" ON "Suspension"("userId", "createdAt" DESC);

CREATE UNIQUE INDEX "BannedIp_ip_key" ON "BannedIp"("ip");

CREATE INDEX "BannedIp_expiresAt_idx" ON "BannedIp"("expiresAt");

CREATE INDEX "SecurityFlag_createdAt_idx" ON "SecurityFlag"("createdAt" DESC);

CREATE INDEX "SecurityFlag_ip_createdAt_idx" ON "SecurityFlag"("ip", "createdAt" DESC);

CREATE INDEX "SecurityFlag_userId_createdAt_idx" ON "SecurityFlag"("userId", "createdAt" DESC);

CREATE INDEX "StaffAuditLog_createdAt_idx" ON "StaffAuditLog"("createdAt" DESC);

CREATE INDEX "StaffAuditLog_staffId_createdAt_idx" ON "StaffAuditLog"("staffId", "createdAt" DESC);

CREATE INDEX "StaffAuditLog_communityId_createdAt_idx" ON "StaffAuditLog"("communityId", "createdAt" DESC);

CREATE INDEX "StaffApplication_status_createdAt_idx" ON "StaffApplication"("status", "createdAt" DESC);

CREATE INDEX "VerificationApplication_status_createdAt_idx" ON "VerificationApplication"("status", "createdAt" DESC);

CREATE INDEX "CopyrightRequest_status_createdAt_idx" ON "CopyrightRequest"("status", "createdAt" DESC);

CREATE INDEX "AnalyticsEvent_targetUserId_communityId_createdAt_type_idx" ON "AnalyticsEvent"("targetUserId", "communityId", "createdAt" DESC, "type");

CREATE UNIQUE INDEX "AnalyticsEvent_targetUserId_communityId_viewerId_postId_typ_key" ON "AnalyticsEvent"("targetUserId", "communityId", "viewerId", "postId", "type");

CREATE INDEX "PendingUpload_createdAt_idx" ON "PendingUpload"("createdAt");

CREATE INDEX "PendingUpload_url_idx" ON "PendingUpload"("url");

CREATE INDEX "TypingStatus_at_idx" ON "TypingStatus"("at");

CREATE UNIQUE INDEX "TypingStatus_conversationId_userId_key" ON "TypingStatus"("conversationId", "userId");

CREATE INDEX "FavoriteGif_userId_createdAt_idx" ON "FavoriteGif"("userId", "createdAt" DESC);

CREATE UNIQUE INDEX "FavoriteGif_userId_gifId_key" ON "FavoriteGif"("userId", "gifId");

ALTER TABLE "User" ADD CONSTRAINT "User_professionalCommunityId_fkey" FOREIGN KEY ("professionalCommunityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Community" ADD CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_professionalReviewedById_fkey" FOREIGN KEY ("professionalReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_professionalProfileUserId_fkey" FOREIGN KEY ("professionalProfileUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_verificationInvitedById_fkey" FOREIGN KEY ("verificationInvitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_pinnedPostId_fkey" FOREIGN KEY ("pinnedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_parentPostId_fkey" FOREIGN KEY ("parentPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_quotedPostId_fkey" FOREIGN KEY ("quotedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Post" ADD CONSTRAINT "Post_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Story" ADD CONSTRAINT "Story_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_sharedPostId_fkey" FOREIGN KEY ("sharedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_sharedStoryId_fkey" FOREIGN KEY ("sharedStoryId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow" ADD CONSTRAINT "Follow_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Like" ADD CONSTRAINT "Like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Like" ADD CONSTRAINT "Like_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Block" ADD CONSTRAINT "Block_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mute" ADD CONSTRAINT "Mute_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mute" ADD CONSTRAINT "Mute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mute" ADD CONSTRAINT "Mute_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotInterested" ADD CONSTRAINT "NotInterested_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotInterested" ADD CONSTRAINT "NotInterested_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotInterested" ADD CONSTRAINT "NotInterested_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" ADD CONSTRAINT "Report_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ADD CONSTRAINT "Report_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_liftedById_fkey" FOREIGN KEY ("liftedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BannedIp" ADD CONSTRAINT "BannedIp_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SecurityFlag" ADD CONSTRAINT "SecurityFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAuditLog" ADD CONSTRAINT "StaffAuditLog_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffApplication" ADD CONSTRAINT "StaffApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VerificationApplication" ADD CONSTRAINT "VerificationApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VerificationApplication" ADD CONSTRAINT "VerificationApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CopyrightRequest" ADD CONSTRAINT "CopyrightRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TypingStatus" ADD CONSTRAINT "TypingStatus_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TypingStatus" ADD CONSTRAINT "TypingStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FavoriteGif" ADD CONSTRAINT "FavoriteGif_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
