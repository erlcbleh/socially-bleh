ALTER TABLE "Follow" DROP COLUMN IF EXISTS "communityId" CASCADE;
ALTER TABLE "Block" DROP COLUMN IF EXISTS "communityId" CASCADE;
ALTER TABLE "Mute" DROP COLUMN IF EXISTS "communityId" CASCADE;

ALTER TABLE "CommunityMembership" DROP COLUMN IF EXISTS "followersCount";
ALTER TABLE "CommunityMembership" DROP COLUMN IF EXISTS "followingCount";

CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "Follow_followingId_idx" ON "Follow"("followingId");
CREATE INDEX IF NOT EXISTS "Follow_followerId_status_idx" ON "Follow"("followerId", "status");
CREATE INDEX IF NOT EXISTS "Follow_followingId_status_createdAt_idx" ON "Follow"("followingId", "status", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "Block_blockedId_idx" ON "Block"("blockedId");
CREATE INDEX IF NOT EXISTS "Block_blockerId_createdAt_idx" ON "Block"("blockerId", "createdAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "Mute_muterId_mutedId_key" ON "Mute"("muterId", "mutedId");
