import { prisma, connectDb, disconnectDb } from "../src/db/prisma.js";
import { newId } from "../src/lib/ids.js";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const demoteArg = args.find((a) => a.startsWith("--demote="));
const demoteRole = demoteArg ? demoteArg.slice("--demote=".length) : "staff";
const positional = args.filter((a) => !a.startsWith("--"));

if (positional.length < 2) {
  console.error("Usage: node scripts/transfer-community.js <community-slug-or-id> <new-owner-username-or-id> [--demote=staff|member] [--confirm]");
  process.exit(1);
}

if (!["owner", "staff", "member"].includes(demoteRole)) {
  console.error(`Invalid --demote role "${demoteRole}". Use staff or member.`);
  process.exit(1);
}

const [communityArg, userArg] = positional;

await connectDb();

const community = await prisma.community.findFirst({
  where: { OR: [{ slug: communityArg.toLowerCase() }, { id: communityArg }] },
  include: { owner: true },
});

if (!community) {
  console.error(`No community matched "${communityArg}".`);
  await disconnectDb();
  process.exit(1);
}

if (community.isGlobal) {
  console.error("Refusing to transfer the global community.");
  await disconnectDb();
  process.exit(1);
}

const newOwner = await prisma.user.findFirst({
  where: { OR: [{ username: userArg.toLowerCase() }, { id: userArg }] },
});

if (!newOwner) {
  console.error(`No user matched "${userArg}".`);
  await disconnectDb();
  process.exit(1);
}

if (community.ownerId === newOwner.id) {
  console.error(`@${newOwner.username} already owns "${community.name}".`);
  await disconnectDb();
  process.exit(1);
}

const [newMembership, oldMembership] = await Promise.all([
  prisma.communityMembership.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: newOwner.id } },
  }),
  community.ownerId
    ? prisma.communityMembership.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: community.ownerId } },
      })
    : Promise.resolve(null),
]);

console.log(`Community: "${community.name}"`);
console.log(`  slug=${community.slug} id=${community.id} members=${community.memberCount}`);
console.log("");
console.log("Current owner:");
if (community.owner) {
  console.log(`  @${community.owner.username} (${community.owner.id})`);
  console.log(`  membership role: ${oldMembership?.role ?? "(no active membership)"}`);
  console.log(`  will be demoted to: ${demoteRole}`);
} else {
  console.log("  (none)");
}
console.log("");
console.log("New owner:");
console.log(`  @${newOwner.username} (${newOwner.id})`);
console.log(`  membership role: ${newMembership?.role ?? "(not a member — will join as owner)"}`);
console.log(`  membership status: ${newMembership?.status ?? "n/a"}`);
console.log("");

if (newMembership && newMembership.status === "banned") {
  console.error(`Refusing: @${newOwner.username} is banned from this community. Unban first.`);
  await disconnectDb();
  process.exit(1);
}

if (!confirm) {
  console.log("Dry run. Re-run with --confirm to transfer.");
  await disconnectDb();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  if (oldMembership && oldMembership.userId !== newOwner.id) {
    await tx.communityMembership.update({
      where: { id: oldMembership.id },
      data: { role: demoteRole },
    });
  }

  if (newMembership) {
    await tx.communityMembership.update({
      where: { id: newMembership.id },
      data: { role: "owner", status: "active", bannedReason: null, bannedById: null, bannedUntil: null },
    });
  } else {
    await tx.communityMembership.create({
      data: {
        id: newId(),
        communityId: community.id,
        userId: newOwner.id,
        role: "owner",
        status: "active",
      },
    });
    await tx.community.update({
      where: { id: community.id },
      data: { memberCount: { increment: 1 } },
    });
  }

  await tx.community.update({
    where: { id: community.id },
    data: { ownerId: newOwner.id },
  });

  await tx.staffAuditLog.create({
    data: {
      id: newId(),
      staffId: newOwner.id,
      action: "transfer_community_ownership",
      targetType: "community",
      targetId: community.id,
      targetUserId: newOwner.id,
      targetLabel: community.slug,
      communityId: community.id,
      important: true,
      meta: {
        previousOwnerId: community.ownerId ?? null,
        previousOwnerUsername: community.owner?.username ?? null,
        newOwnerUsername: newOwner.username,
        demotedTo: oldMembership ? demoteRole : null,
        via: "script",
      },
    },
  });
});

console.log(`Transferred "${community.name}" to @${newOwner.username}.`);
if (community.owner) {
  console.log(`Demoted @${community.owner.username} to ${demoteRole}.`);
}

await disconnectDb();
