ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "badges" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedBadges" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "BannedDiscordId" (
    "id" CHAR(24) NOT NULL,
    "discordId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "bannedById" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BannedDiscordId_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BannedDiscordId_discordId_key" ON "BannedDiscordId"("discordId");

DO $$ BEGIN
  ALTER TABLE "BannedDiscordId" ADD CONSTRAINT "BannedDiscordId_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
