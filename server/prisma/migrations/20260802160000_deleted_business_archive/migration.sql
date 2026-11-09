CREATE TABLE IF NOT EXISTS "DeletedBusiness" (
    "id" CHAR(24) NOT NULL,
    "businessUserId" CHAR(24) NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "bannerUrl" TEXT NOT NULL DEFAULT '',
    "ownerId" CHAR(24),
    "ownerUsername" TEXT NOT NULL DEFAULT '',
    "collaborators" JSONB,
    "discordInviteUrl" TEXT NOT NULL DEFAULT '',
    "discordGuildId" VARCHAR(32),
    "discordGuildName" TEXT NOT NULL DEFAULT '',
    "discordMemberCount" INTEGER NOT NULL DEFAULT 0,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "accountCreatedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "deletedById" CHAR(24),
    "deletedByUsername" TEXT NOT NULL DEFAULT '',
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedBusiness_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeletedBusiness_deletedAt_idx" ON "DeletedBusiness"("deletedAt" DESC);
CREATE INDEX IF NOT EXISTS "DeletedBusiness_username_idx" ON "DeletedBusiness"("username");
CREATE INDEX IF NOT EXISTS "DeletedBusiness_businessUserId_idx" ON "DeletedBusiness"("businessUserId");
