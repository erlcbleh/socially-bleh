ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordInviteUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordGuildId" VARCHAR(32);
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordGuildName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordGuildIconUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordMemberCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordPresenceCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordCheckedAt" TIMESTAMP(3);
ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "guidelinesAcceptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "BusinessApplication_discordGuildId_status_idx" ON "BusinessApplication"("discordGuildId", "status");
