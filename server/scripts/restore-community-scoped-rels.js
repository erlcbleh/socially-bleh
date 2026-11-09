
import { prisma } from "../src/db/prisma.js";

async function run(sql) {
  console.log(">", sql.replace(/\s+/g, " ").trim().slice(0, 120));
  await prisma.$executeRawUnsafe(sql);
}

try {
  const global = await prisma.community.findFirst({
    where: { isGlobal: true },
    select: { id: true },
  });
  if (!global) throw new Error("Global community missing");
  const gid = global.id;

  for (const [table, prefix] of [
    ["Follow", "followerId"],
    ["Block", "blockerId"],
    ["Mute", "muterId"],
  ]) {
    await run(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "communityId" CHAR(24)`);
    await run(`UPDATE "${table}" SET "communityId" = '${gid}' WHERE "communityId" IS NULL`);
    await run(`ALTER TABLE "${table}" ALTER COLUMN "communityId" SET NOT NULL`);
    await run(`
      DO $$ BEGIN
        ALTER TABLE "${table}" ADD CONSTRAINT "${table}_communityId_fkey"
          FOREIGN KEY ("communityId") REFERENCES "Community"(id) ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  await run(`CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followingId_communityId_key" ON "Follow"("followerId", "followingId", "communityId")`);
  await run(`CREATE INDEX IF NOT EXISTS "Follow_communityId_followingId_idx" ON "Follow"("communityId", "followingId")`);
  await run(`CREATE INDEX IF NOT EXISTS "Follow_followerId_communityId_status_idx" ON "Follow"("followerId", "communityId", status)`);
  await run(`DROP INDEX IF EXISTS "Follow_followerId_followingId_key"`);

  await run(`CREATE UNIQUE INDEX IF NOT EXISTS "Block_blockerId_blockedId_communityId_key" ON "Block"("blockerId", "blockedId", "communityId")`);
  await run(`DROP INDEX IF EXISTS "Block_blockerId_blockedId_key"`);

  await run(`CREATE UNIQUE INDEX IF NOT EXISTS "Mute_muterId_mutedId_communityId_key" ON "Mute"("muterId", "mutedId", "communityId")`);
  await run(`DROP INDEX IF EXISTS "Mute_muterId_mutedId_key"`);

  await run(`ALTER TABLE "CommunityMembership" ADD COLUMN IF NOT EXISTS "followersCount" INTEGER NOT NULL DEFAULT 0`);
  await run(`ALTER TABLE "CommunityMembership" ADD COLUMN IF NOT EXISTS "followingCount" INTEGER NOT NULL DEFAULT 0`);

  await run(`
    UPDATE "CommunityMembership" m SET "followersCount" = sub.n
    FROM (
      SELECT "followingId" AS uid, "communityId" AS cid, COUNT(*)::int AS n
      FROM "Follow" WHERE status = 'accepted' GROUP BY "followingId", "communityId"
    ) sub WHERE m."userId" = sub.uid AND m."communityId" = sub.cid
  `);
  await run(`
    UPDATE "CommunityMembership" m SET "followingCount" = sub.n
    FROM (
      SELECT "followerId" AS uid, "communityId" AS cid, COUNT(*)::int AS n
      FROM "Follow" WHERE status = 'accepted' GROUP BY "followerId", "communityId"
    ) sub WHERE m."userId" = sub.uid AND m."communityId" = sub.cid
  `);

  await run(`DELETE FROM "_prisma_migrations" WHERE migration_name = '20260731020000_restore_global_relationships' AND finished_at IS NULL`);

  const follow = await prisma.follow.findFirst({ select: { id: true, communityId: true } });
  console.log("verify", follow);
  console.log("restore-ok");
} catch (e) {
  console.error("restore-failed", e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
