import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "../config/env.js";

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export async function connectDb() {
  await prisma.$connect();
  console.log("PostgreSQL connected");
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BusinessApplication" (
        "id" CHAR(24) PRIMARY KEY,
        "applicantId" CHAR(24) NOT NULL,
        "name" TEXT NOT NULL,
        "bio" TEXT NOT NULL DEFAULT '',
        "logoUrl" TEXT NOT NULL DEFAULT '',
        "bannerUrl" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'pending',
        "staffNote" TEXT NOT NULL DEFAULT '',
        "reviewedById" CHAR(24),
        "reviewedAt" TIMESTAMP(3),
        "businessUserId" CHAR(24),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordInviteUrl" TEXT NOT NULL DEFAULT '';
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordGuildId" VARCHAR(32);
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordGuildName" TEXT NOT NULL DEFAULT '';
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordGuildIconUrl" TEXT NOT NULL DEFAULT '';
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordMemberCount" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordPresenceCount" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "discordCheckedAt" TIMESTAMP(3);
      ALTER TABLE "BusinessApplication" ADD COLUMN IF NOT EXISTS "guidelinesAcceptedAt" TIMESTAMP(3);
      CREATE INDEX IF NOT EXISTS "BusinessApplication_discordGuildId_status_idx" ON "BusinessApplication"("discordGuildId", "status");
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessOwnerId" CHAR(24);
      CREATE INDEX IF NOT EXISTS "User_businessOwnerId_idx" ON "User"("businessOwnerId");
      CREATE INDEX IF NOT EXISTS "Notification_recipientId_read_createdAt_idx" ON "Notification"("recipientId", "read", "createdAt" DESC);
    `);
  } catch (err) {
    console.error("Table/Column verification notice:", err?.message || err);
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
  await pool.end();
}
