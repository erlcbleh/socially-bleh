import { prisma } from "../db/prisma.js";
import { isValidObjectId } from "../lib/ids.js";
import { hydratePosts, serializeUser, POST_INCLUDE } from "../services/hydrate.js";

const REPORT_STATUSES = ["pending", "actioned", "dismissed"];
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function parseCursor(raw) {
  if (!raw || typeof raw !== "string") return null;
  const [createdAt, id] = raw.split("_");
  const date = new Date(Number(createdAt));
  if (Number.isNaN(date.getTime()) || !isValidObjectId(id)) return null;
  return { createdAt: date, id };
}

function makeCursor(report) {
  return `${report.createdAt.getTime()}_${report.id}`;
}

function serializeReport(report, { postMap, userMap, messageMap }) {
  const targetId = report.targetId;
  return {
    id: report.id,
    reporter: report.reporter ? serializeUser(report.reporter, {}) : null,
    source: report.source,
    communitySlug: report.community?.slug || null,
    communityName: report.community?.name || null,
    targetType: report.targetType,
    targetId,
    targetPost: report.targetType === "post" ? postMap.get(targetId) || null : null,
    targetUser: report.targetType === "user" ? userMap.get(targetId) || null : null,
    targetMessage: report.targetType === "message" ? messageMap.get(targetId) || null : null,
    contentSnapshot: report.contentSnapshot,
    snapshot: report.snapshot || null,
    reason: report.reason,
    details: report.details,
    status: report.status,
    actionTaken: report.actionTaken,
    staffNote: report.staffNote || "",
    reviewedAt: report.reviewedAt || null,
    createdAt: report.createdAt,
  };
}

async function hydrateTargets(reports, viewerId) {
  const postIds = reports.filter((r) => r.targetType === "post").map((r) => r.targetId);
  const userIds = reports.filter((r) => r.targetType === "user").map((r) => r.targetId);
  const messageIds = reports.filter((r) => r.targetType === "message").map((r) => r.targetId);

  const [posts, users, messages] = await Promise.all([
    postIds.length
      ? prisma.post.findMany({ where: { id: { in: postIds } }, include: POST_INCLUDE })
      : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } } }) : [],
    messageIds.length
      ? prisma.message.findMany({ where: { id: { in: messageIds } }, include: { sender: true } })
      : [],
  ]);

  const hydratedPosts = posts.length ? await hydratePosts(posts, viewerId) : [];

  return {
    postMap: new Map(hydratedPosts.map((p) => [p.id, p])),
    userMap: new Map(users.map((u) => [u.id, serializeUser(u, {})])),
    messageMap: new Map(
      messages.map((m) => [
        m.id,
        {
          id: m.id,
          sender: m.sender ? serializeUser(m.sender, {}) : null,
          content: m.content,
          createdAt: m.createdAt,
        },
      ])
    ),
  };
}

export async function listPanelReports(req, res) {
  const status = REPORT_STATUSES.includes(req.query.status) ? req.query.status : "pending";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT));
  const cursor = parseCursor(req.query.cursor);

  const where = { status };
  if (req.query.source === "ai" || req.query.source === "user") where.source = req.query.source;
  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }

  const reports = await prisma.report.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { reporter: true, community: true },
  });

  const hasMore = reports.length > limit;
  const page = hasMore ? reports.slice(0, limit) : reports;
  const maps = await hydrateTargets(page, req.staffUser.id);

  res.json({
    items: page.map((report) => serializeReport(report, maps)),
    nextCursor: hasMore && page.length > 0 ? makeCursor(page[page.length - 1]) : null,
  });
}

export async function getPanelReport(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Report not found" });

  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { reporter: true, community: true },
  });
  if (!report) return res.status(404).json({ message: "Report not found" });

  const maps = await hydrateTargets([report], req.staffUser.id);
  res.json({ report: serializeReport(report, maps) });
}

export async function getQueueCounts(req, res) {
  const [
    pending,
    aiPending,
    actioned,
    dismissed,
    verificationPending,
    copyrightPending,
    staffApplicationsPending,
    businessApplicationsPending,
  ] = await Promise.all([
    prisma.report.count({ where: { status: "pending" } }),
    prisma.report.count({ where: { status: "pending", source: "ai" } }),
    prisma.report.count({ where: { status: "actioned" } }),
    prisma.report.count({ where: { status: "dismissed" } }),
    prisma.verificationApplication.count({ where: { status: "pending" } }),
    prisma.copyrightRequest.count({ where: { status: "pending" } }),
    prisma.staffApplication.count({ where: { status: "pending" } }),
    prisma.businessApplication.count({ where: { status: "pending" } }),
  ]);

  res.json({
    reports: { pending, aiPending, actioned, dismissed },
    verification: { pending: verificationPending },
    copyright: { pending: copyrightPending },
    staffApplications: { pending: staffApplicationsPending },
    businessApplications: { pending: businessApplicationsPending },
  });
}
