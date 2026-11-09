import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";

async function upsertAnalyticsEvent(data) {
  const where = {
    targetUserId: data.targetUserId,
    communityId: data.communityId,
    viewerId: data.viewerId,
    postId: data.postId,
    type: data.type,
  };

  if (data.postId == null) {
    const existing = await prisma.analyticsEvent.findFirst({ where });
    if (!existing) {
      await prisma.analyticsEvent.create({ data: { id: newId(), ...data } });
    }
    return;
  }

  await prisma.analyticsEvent.upsert({
    where: { targetUserId_communityId_viewerId_postId_type: where },
    create: { id: newId(), ...data },
    update: {},
  });
}

export async function logImpressions(req, res) {
  const communityId = req.community.id;
  const postIds = (Array.isArray(req.body.postIds) ? req.body.postIds : [])
    .filter((id) => isValidObjectId(id))
    .slice(0, 50);
  if (!postIds.length) return res.json({ ok: true });

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, communityId },
    select: { id: true, authorId: true },
  });
  const authorIds = [...new Set(posts.map((post) => post.authorId))];
  const businessAuthors = await prisma.user.findMany({
    where: {
      id: { in: authorIds },
      accountKind: "business",
    },
    select: { id: true },
  });
  const businessAuthorIds = new Set(businessAuthors.map((u) => u.id));

  const eligible = posts.filter(
    (post) => businessAuthorIds.has(post.authorId) && post.authorId !== req.user.id
  );

  const events = eligible.map((post) => ({
    targetUserId: post.authorId,
    communityId,
    type: "impression",
    postId: post.id,
    viewerId: req.user.id,
  }));

  if (events.length) {
    const insertedPostIds = [];
    for (const event of events) {
      try {
        await prisma.analyticsEvent.create({
          data: { id: newId(), ...event },
        });
        insertedPostIds.push(event.postId);
      } catch (err) {
        if (err.code !== "P2002") throw err;
      }
    }

    if (insertedPostIds.length) {
      await Promise.all(
        insertedPostIds.map((postId) =>
          prisma.post.update({
            where: { id: postId },
            data: { impressionsCount: { increment: 1 } },
          })
        )
      );
    }
  }

  res.json({ ok: true });
}

export async function logProfileView(req, res) {
  const communityId = req.community.id;
  const target = await prisma.user.findFirst({ where: { username: req.params.username.toLowerCase() } });
  if (!target) return res.status(404).json({ message: "User not found" });
  if (target.id === req.user.id) return res.json({ ok: true });

  if (target.accountKind !== "business") return res.json({ ok: true });

  await upsertAnalyticsEvent({
    targetUserId: target.id,
    communityId,
    viewerId: req.user.id,
    type: "profile_view",
    postId: null,
  });
  res.json({ ok: true });
}

export async function logClick(req, res) {
  const communityId = req.community.id;
  const { targetUsername, postId } = req.body;
  const target = await prisma.user.findFirst({
    where: { username: String(targetUsername || "").toLowerCase() },
  });
  if (!target) return res.json({ ok: true });
  if (target.id === req.user.id) return res.json({ ok: true });

  if (target.accountKind !== "business") return res.json({ ok: true });

  let resolvedPostId = null;
  if (postId) {
    if (!isValidObjectId(postId)) return res.json({ ok: true });
    const found = await prisma.post.findFirst({
      where: { id: postId, communityId, authorId: target.id },
      select: { id: true },
    });
    if (!found) return res.json({ ok: true });
    resolvedPostId = found.id;
  }

  await upsertAnalyticsEvent({
    targetUserId: target.id,
    communityId,
    viewerId: req.user.id,
    postId: resolvedPostId,
    type: "click",
  });
  res.json({ ok: true });
}

export async function summary(req, res) {
  if (req.user.accountKind !== "business") {
    return res.status(403).json({ message: "Analytics is only available for business accounts." });
  }

  const rangeDays = req.query.range === "30d" ? 30 : 7;
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const events = await prisma.analyticsEvent.findMany({
    where: {
      targetUserId: req.user.id,
      communityId: req.community.id,
      createdAt: { gte: since },
    },
    select: { type: true, createdAt: true },
  });

  const seriesMap = new Map();
  for (const event of events) {
    const date = event.createdAt.toISOString().slice(0, 10);
    const day = seriesMap.get(date) || { date, profileViews: 0, impressions: 0, clicks: 0 };
    if (event.type === "profile_view") day.profileViews += 1;
    else if (event.type === "impression") day.impressions += 1;
    else if (event.type === "click") day.clicks += 1;
    seriesMap.set(date, day);
  }

  const series = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const totals = series.reduce(
    (sum, day) => ({
      profileViews: sum.profileViews + day.profileViews,
      impressions: sum.impressions + day.impressions,
      clicks: sum.clicks + day.clicks,
    }),
    { profileViews: 0, impressions: 0, clicks: 0 }
  );

  res.json({ ...totals, series });
}
