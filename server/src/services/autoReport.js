import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { ensureGlobalCommunity } from "./globalCommunity.js";
import { buildTextSnapshot, describeSnapshot } from "./reportSnapshot.js";
import { reportCreated } from "./staffEvents.js";

export async function fileAutoReport({
  community,
  targetType,
  targetId,
  snapshot,
  author = null,
  category,
  rationale,
  blocked = false,
}) {
  let communityId = community;

  if (!communityId) {
    const global = await ensureGlobalCommunity().catch(() => null);
    communityId = global?.id;
  }
  if (!communityId || !targetId) return null;

  const snapshotDoc =
    snapshot && typeof snapshot === "object"
      ? snapshot
      : buildTextSnapshot(snapshot ?? "", { kind: targetType, author });

  return prisma.report
    .create({
      data: {
        id: newId(),
        reporterId: null,
        source: "ai",
        communityId: String(communityId),
        targetType,
        targetId: String(targetId),
        contentSnapshot: describeSnapshot(snapshotDoc).slice(0, 1000),
        snapshot: snapshotDoc,
        reason: `${blocked ? "auto_blocked" : "auto_flagged"}: ${category}`.slice(0, 100),
        details: (rationale || "Automatically detected by content moderation.").slice(0, 500),
      },
    })
    .then((report) => {
      reportCreated(report);
      return report;
    })
    .catch((err) => {
      console.error("Failed to file automatic moderation report", err);
      return null;
    });
}
