import { prisma } from "../db/prisma.js";
import { logStaffAction } from "./auditLog.js";
import { notify } from "./notify.js";
import { reportUpdated } from "./staffEvents.js";

const PENDING_SCAN_LIMIT = 1000;
const AUTO_ACTION_TAKEN = "auto_resolved_deactivated";

async function findPendingReportsForUser(userId, excludeReportId) {
  const base = {
    status: "pending",
    ...(excludeReportId ? { id: { not: excludeReportId } } : {}),
  };

  const [direct, contentReports] = await Promise.all([
    prisma.report.findMany({ where: { ...base, targetType: "user", targetId: userId } }),
    prisma.report.findMany({
      where: { ...base, targetType: { in: ["post", "message"] } },
      orderBy: { createdAt: "desc" },
      take: PENDING_SCAN_LIMIT,
    }),
  ]);

  const postIds = contentReports.filter((r) => r.targetType === "post").map((r) => r.targetId);
  const messageIds = contentReports.filter((r) => r.targetType === "message").map((r) => r.targetId);

  const [posts, messages] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({ where: { id: { in: postIds }, authorId: userId }, select: { id: true } })
      : [],
    messageIds.length
      ? prisma.message.findMany({
          where: { id: { in: messageIds }, senderId: userId },
          select: { id: true },
        })
      : [],
  ]);

  const ownedPosts = new Set(posts.map((p) => p.id));
  const ownedMessages = new Set(messages.map((m) => m.id));

  const owned = contentReports.filter((r) =>
    r.targetType === "post" ? ownedPosts.has(r.targetId) : ownedMessages.has(r.targetId)
  );

  return [...direct, ...owned];
}

export async function autoResolveReportsForDeactivatedUser(userId, { staffId, excludeReportId } = {}) {
  const reports = await findPendingReportsForUser(String(userId), excludeReportId);
  if (reports.length === 0) return { resolved: 0, reportIds: [] };

  const reportIds = reports.map((report) => report.id);

  await prisma.report.updateMany({
    where: { id: { in: reportIds } },
    data: {
      status: "actioned",
      actionTaken: AUTO_ACTION_TAKEN,
      reviewedById: staffId ? String(staffId) : undefined,
      reviewedAt: new Date(),
    },
  });

  await logStaffAction({
    staffId,
    action: "auto_resolve_reports",
    targetType: "user",
    targetId: userId,
    targetUser: userId,
    targetLabel: `${reportIds.length} report(s)`,
    meta: {
      trigger: "user_deactivated",
      triggerReportId: excludeReportId || undefined,
      resolvedCount: reportIds.length,
      reportIds: reportIds.slice(0, 50),
    },
  });

  for (const report of reports) {
    reportUpdated(report);
    if (report.reporterId && staffId) {
      await notify({
        recipient: report.reporterId,
        actor: staffId,
        type: "report_actioned",
        post: report.targetType === "post" ? report.targetId : null,
        community: report.communityId,
      });
    }
  }

  return { resolved: reportIds.length, reportIds };
}
