DELETE FROM "Follow" a
USING (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "followerId", "followingId"
    ORDER BY CASE WHEN "status" = 'accepted' THEN 0 ELSE 1 END, "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "Follow"
) dupes
WHERE a."id" = dupes."id" AND dupes.rn > 1;

DELETE FROM "Block" a
USING (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "blockerId", "blockedId"
    ORDER BY "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "Block"
) dupes
WHERE a."id" = dupes."id" AND dupes.rn > 1;

DELETE FROM "Mute" a
USING (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "muterId", "mutedId"
    ORDER BY "createdAt" ASC, "id" ASC
  ) AS rn
  FROM "Mute"
) dupes
WHERE a."id" = dupes."id" AND dupes.rn > 1;

ALTER TABLE "Follow" DROP CONSTRAINT "Follow_communityId_fkey";
ALTER TABLE "Block" DROP CONSTRAINT "Block_communityId_fkey";
ALTER TABLE "Mute" DROP CONSTRAINT "Mute_communityId_fkey";

DROP INDEX "Follow_communityId_followingId_idx";
DROP INDEX "Follow_followerId_communityId_status_idx";
DROP INDEX "Follow_followingId_communityId_status_createdAt_idx";
DROP INDEX "Follow_followerId_followingId_communityId_key";
DROP INDEX "Block_blockedId_communityId_idx";
DROP INDEX "Block_blockerId_communityId_createdAt_idx";
DROP INDEX "Block_blockerId_blockedId_communityId_key";
DROP INDEX "Mute_muterId_mutedId_communityId_key";

ALTER TABLE "Follow" DROP COLUMN "communityId";
ALTER TABLE "Block" DROP COLUMN "communityId";
ALTER TABLE "Mute" DROP COLUMN "communityId";

CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");
CREATE INDEX "Follow_followerId_status_idx" ON "Follow"("followerId", "status");
CREATE INDEX "Follow_followingId_status_createdAt_idx" ON "Follow"("followingId", "status", "createdAt" DESC);
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");
CREATE INDEX "Block_blockerId_createdAt_idx" ON "Block"("blockerId", "createdAt" DESC);
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

CREATE UNIQUE INDEX "Mute_muterId_mutedId_key" ON "Mute"("muterId", "mutedId");

ALTER TABLE "User" ADD COLUMN "staffSessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "followersCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "followingCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "User" u SET "followersCount" = c.total
FROM (
  SELECT "followingId" AS uid, COUNT(*)::int AS total
  FROM "Follow" WHERE "status" = 'accepted' GROUP BY "followingId"
) c
WHERE u."id" = c.uid;

UPDATE "User" u SET "followingCount" = c.total
FROM (
  SELECT "followerId" AS uid, COUNT(*)::int AS total
  FROM "Follow" WHERE "status" = 'accepted' GROUP BY "followerId"
) c
WHERE u."id" = c.uid;

ALTER TABLE "CommunityMembership" DROP COLUMN "followersCount";
ALTER TABLE "CommunityMembership" DROP COLUMN "followingCount";

CREATE TABLE "StaffSession" (
    "id" CHAR(24) NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" VARCHAR(500) NOT NULL DEFAULT '',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffSession_jti_key" ON "StaffSession"("jti");
CREATE INDEX "StaffSession_userId_createdAt_idx" ON "StaffSession"("userId", "createdAt" DESC);
CREATE INDEX "StaffSession_revokedAt_idx" ON "StaffSession"("revokedAt");
CREATE INDEX "StaffSession_absoluteExpiresAt_idx" ON "StaffSession"("absoluteExpiresAt");

ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Report" ADD COLUMN "snapshot" JSONB;
ALTER TABLE "Report" ADD COLUMN "staffNote" TEXT NOT NULL DEFAULT '';
