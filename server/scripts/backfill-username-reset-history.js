import { prisma } from "../src/db/prisma.js";

async function main() {
  const entries = await prisma.staffAuditLog.findMany({
    where: { action: "reset_username" },
    select: { targetUserId: true, meta: true, createdAt: true },
  });

  if (!entries.length) {
    console.log("No reset_username audit entries found.");
    return;
  }

  const byUser = new Map();
  for (const entry of entries) {
    if (!entry.targetUserId) continue;
    const prev = entry.meta?.previous;
    if (!prev) continue;
    const set = byUser.get(entry.targetUserId) ?? new Set();
    set.add(String(prev).toLowerCase());
    byUser.set(entry.targetUserId, set);
  }

  let updated = 0;
  let removedTotal = 0;

  for (const [userId, prevSet] of byUser) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { previousUsernames: true },
    });
    if (!user) continue;

    const history = Array.isArray(user.previousUsernames) ? user.previousUsernames : [];
    const filtered = history.filter(
      (entry) => !entry?.username || !prevSet.has(String(entry.username).toLowerCase())
    );

    if (filtered.length === history.length) continue;

    removedTotal += history.length - filtered.length;
    await prisma.user.update({
      where: { id: userId },
      data: { previousUsernames: filtered },
    });
    updated++;
  }

  console.log(`Processed ${byUser.size} user(s); updated ${updated}, removed ${removedTotal} history entr(y/ies).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
