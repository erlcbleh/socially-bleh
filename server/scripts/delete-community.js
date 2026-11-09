import { prisma, connectDb, disconnectDb } from "../src/db/prisma.js";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.error("Usage: node scripts/delete-community.js <slug-or-id> [--confirm]");
  process.exit(1);
}

await connectDb();

const community = await prisma.community.findFirst({
  where: { OR: [{ slug: target.toLowerCase() }, { id: target }] },
});

if (!community) {
  console.error(`No community matched "${target}".`);
  await disconnectDb();
  process.exit(1);
}

if (community.isGlobal) {
  console.error("Refusing to delete the global community.");
  await disconnectDb();
  process.exit(1);
}

const communityId = community.id;

const [memberships, posts, stories, likes, bookmarks, pollVotes, notInterested, reports, analytics, conversations, notifications, auditLogs] =
  await Promise.all([
    prisma.communityMembership.count({ where: { communityId } }),
    prisma.post.count({ where: { communityId } }),
    prisma.story.count({ where: { communityId } }),
    prisma.like.count({ where: { communityId } }),
    prisma.bookmark.count({ where: { communityId } }),
    prisma.pollVote.count({ where: { communityId } }),
    prisma.notInterested.count({ where: { communityId } }),
    prisma.report.count({ where: { communityId } }),
    prisma.analyticsEvent.count({ where: { communityId } }),
    prisma.conversation.count({ where: { communityId } }),
    prisma.notification.count({ where: { communityId } }),
    prisma.staffAuditLog.count({ where: { communityId } }),
  ]);

console.log(`Community: "${community.name}"`);
console.log(`  slug=${community.slug} id=${communityId} owner=${community.ownerId ?? "(none)"} members=${community.memberCount}`);
console.log("");
console.log("Will be DELETED (cascade):");
console.log(`  memberships   ${memberships}`);
console.log(`  posts         ${posts}`);
console.log(`  stories       ${stories}`);
console.log(`  likes         ${likes}`);
console.log(`  bookmarks     ${bookmarks}`);
console.log(`  pollVotes     ${pollVotes}`);
console.log(`  notInterested ${notInterested}`);
console.log(`  reports       ${reports}`);
console.log(`  analytics     ${analytics}`);
console.log("");
console.log("Will be KEPT (community link set to null):");
console.log(`  conversations ${conversations}`);
console.log(`  notifications ${notifications}`);
console.log(`  auditLogs     ${auditLogs}`);
console.log("");

if (!confirm) {
  console.log("Dry run. Re-run with --confirm to delete.");
  await disconnectDb();
  process.exit(0);
}

await prisma.community.delete({ where: { id: communityId } });
console.log(`Deleted "${community.name}".`);

await disconnectDb();
