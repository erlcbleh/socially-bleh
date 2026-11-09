import mongoose from "mongoose";
import { connectDb } from "../src/db/connect.js";
import { Conversation } from "../src/models/Conversation.js";
import { Message } from "../src/models/Message.js";

const APPLY = process.argv.includes("--apply");

function pairKey(participants) {
  return participants
    .map((p) => p.toString())
    .sort()
    .join("|");
}

function activityOf(conversation) {
  return new Date(conversation.lastMessageAt || conversation.createdAt || 0).getTime();
}

async function refreshPreview(conversation) {
  const latest = await Message.findOne({
    conversation: conversation._id,
    deletedAt: null,
    moderationState: { $nin: ["pending", "blocked"] },
  })
    .sort({ createdAt: -1, _id: -1 })
    .select("content mediaUrl gifUrl sharedPost sharedStory createdAt")
    .lean();

  let text = "";
  if (latest) {
    if (latest.content) text = latest.content;
    else if (latest.mediaUrl) text = "Sent an attachment";
    else if (latest.gifUrl) text = "Sent a GIF";
    else if (latest.sharedPost) text = "Shared a post";
    else if (latest.sharedStory) text = "Shared a story";
  }

  conversation.lastMessageText = text;
  conversation.lastMessageAt = latest ? latest.createdAt : null;
  conversation.community = null;

  if (APPLY) await conversation.save();
}

async function run() {
  await connectDb();

  const conversations = await Conversation.find({ isGroup: false }).sort({ createdAt: 1 });

  const groups = new Map();
  for (const conversation of conversations) {
    if (!Array.isArray(conversation.participants) || conversation.participants.length !== 2) continue;
    const key = pairKey(conversation.participants);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(conversation);
  }

  let duplicateSets = 0;
  let conversationsRemoved = 0;
  let messagesMoved = 0;
  let previewsRefreshed = 0;
  let scopeCleared = 0;

  for (const [, set] of groups) {
    if (set.length === 1) {
      const only = set[0];
      if (only.community !== null) {
        scopeCleared += 1;
        only.community = null;
        if (APPLY) await only.save();
      }
      continue;
    }

    duplicateSets += 1;

    const sorted = [...set].sort((a, b) => activityOf(b) - activityOf(a));
    const keeper = sorted[0];
    const losers = sorted.slice(1);
    const loserIds = losers.map((c) => c._id);

    const moving = await Message.countDocuments({ conversation: { $in: loserIds } });
    messagesMoved += moving;
    conversationsRemoved += losers.length;

    console.log(
      `pair ${pairKey(keeper.participants)}: keeping ${keeper._id} (last active ${
        keeper.lastMessageAt ? new Date(keeper.lastMessageAt).toISOString() : "never"
      }), merging ${losers.length} duplicate(s), moving ${moving} message(s)`
    );

    if (APPLY) {
      await Message.updateMany({ conversation: { $in: loserIds } }, { $set: { conversation: keeper._id } });
      await Conversation.deleteMany({ _id: { $in: loserIds } });
    }

    await refreshPreview(keeper);
    previewsRefreshed += 1;
  }

  console.log("");
  console.log(APPLY ? "APPLIED" : "DRY RUN - nothing was written");
  console.log(`  direct conversations scanned : ${conversations.length}`);
  console.log(`  unique participant pairs     : ${groups.size}`);
  console.log(`  pairs with duplicates        : ${duplicateSets}`);
  console.log(`  conversations to delete      : ${conversationsRemoved}`);
  console.log(`  messages to repoint          : ${messagesMoved}`);
  console.log(`  previews to refresh          : ${previewsRefreshed}`);
  console.log(`  single threads to de-scope   : ${scopeCleared}`);

  if (!APPLY) console.log("\nRe-run with --apply to write these changes.");

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
