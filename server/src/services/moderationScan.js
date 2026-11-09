import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { moderateImages } from "./moderation.js";
import { screenText, moderationCoolingDown, moderationCooldownRemainingMs } from "./textModeration.js";
import { videoFrameUrls, moderationImageUrl } from "./cloudinary.js";
import { notify } from "./notify.js";
import { buildPostSnapshot, describeSnapshot } from "./reportSnapshot.js";
import { reportCreated } from "./staffEvents.js";

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 40;
const CONCURRENCY = 4;

const TEXT_ALREADY_CLEAR = { action: "allow", category: "none", failed: false, retryable: false };

function mediaUrlsFor(post) {
  const urls = [];

  if (post.mediaUrl) {
    if (post.mediaType === "video") urls.push(...videoFrameUrls(post.mediaUrl));
    else urls.push(moderationImageUrl(post.mediaUrl));
  }
  if (post.gifUrl) urls.push(post.gifUrl);
  if (post.poll?.imageUrl) urls.push(moderationImageUrl(post.poll.imageUrl));

  return urls;
}

async function mapLimit(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        await worker(item);
      } catch (err) {
        console.error("Moderation scan item failed", err);
      }
    }
  });
  await Promise.all(runners);
}

async function scanPost(post) {
  const imageUrls = mediaUrlsFor(post);

  const [image, text] = await Promise.all([
    imageUrls.length ? moderateImages({ imageUrls }) : Promise.resolve({ flagged: false, categories: [], failed: false }),
    post.moderationTextClear ? Promise.resolve(TEXT_ALREADY_CLEAR) : screenText(post.content),
  ]);

  const flagged = image.flagged || text.action !== "allow";
  const categories = [...image.categories];
  if (text.action !== "allow") categories.push(text.category);

  const failed = image.failed || text.failed;
  const retryable = (image.failed && image.retryable) || (text.failed && text.retryable);

  if (failed && retryable && post.moderationAttempts < MAX_ATTEMPTS) {
    await prisma.post.update({
      where: { id: post.id },
      data: { moderationAttempts: { increment: 1 } },
    });
    return;
  }

  if (flagged) {
    const snapshot = buildPostSnapshot(post, post.author);
    const report = await prisma.report.create({
      data: {
        id: newId(),
        reporterId: null,
        source: "ai",
        communityId: post.communityId,
        targetType: "post",
        targetId: post.id,
        contentSnapshot: describeSnapshot(snapshot),
        snapshot,
        reason: `auto_flagged: ${categories.join(", ") || "unspecified"}`,
        details: "Automatically flagged by content moderation for staff review.",
      },
    });
    reportCreated(report);
    await prisma.post.update({
      where: { id: post.id },
      data: { moderationStatus: "flagged" },
    });
    await notify({
      recipient: post.authorId,
      actor: post.authorId,
      type: "content_flagged",
      post: post.id,
      community: post.communityId,
      allowSelf: true,
    });
  } else {
    await prisma.post.update({
      where: { id: post.id },
      data: { moderationStatus: "clear" },
    });
  }
}

export async function scanPendingPosts() {
  if (moderationCoolingDown()) {
    console.log(`Moderation scan skipped; rate limit cooldown for ${Math.round(moderationCooldownRemainingMs() / 1000)}s.`);
    return;
  }

  const posts = await prisma.post.findMany({
    where: { moderationStatus: "pending", deleted: false },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    include: { author: true },
  });

  if (!posts.length) return;

  await mapLimit(posts, CONCURRENCY, scanPost);
}
