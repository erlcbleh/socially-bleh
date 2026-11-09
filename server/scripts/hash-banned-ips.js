import { prisma } from "../src/db/prisma.js";
import { hashIp, isIpHash } from "../src/lib/ipHash.js";

async function main() {
  const rows = await prisma.bannedIp.findMany({ select: { id: true, ipHash: true } });
  const pending = rows.filter((row) => row.ipHash && !isIpHash(row.ipHash));

  if (!pending.length) {
    console.log(`Nothing to convert - ${rows.length} ban(s) already hashed.`);
    return;
  }

  let converted = 0;
  let merged = 0;

  for (const row of pending) {
    const ipHash = hashIp(row.ipHash);
    const existing = await prisma.bannedIp.findUnique({ where: { ipHash }, select: { id: true } });
    if (existing) {
      await prisma.bannedIp.delete({ where: { id: row.id } });
      merged += 1;
      continue;
    }
    await prisma.bannedIp.update({ where: { id: row.id }, data: { ipHash } });
    converted += 1;
  }

  console.log(`Hashed ${converted} ban(s), merged ${merged} duplicate(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
