import axios from "axios";

const WEBHOOK_URL_RE = /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{30,})\/?$/;

const SHARE_BASE_URL = "https://scly.lol";

const RATE_LIMIT_BURST = 8;
const RATE_LIMIT_WINDOW_MS = 15_000;

const sendTimesByCommunity = new Map();

export function parseDiscordWebhookUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!WEBHOOK_URL_RE.test(trimmed)) return null;
  return trimmed;
}

export async function fetchDiscordWebhookInfo(webhookUrl) {
  try {
    const res = await axios.get(webhookUrl, { timeout: 5000 });
    if (res.status !== 200 || !res.data) return null;
    return {
      channelId: res.data.channel_id ? String(res.data.channel_id) : null,
      channelName: typeof res.data.channel_name === "string" && res.data.channel_name ? res.data.channel_name : null,
      webhookName: typeof res.data.name === "string" && res.data.name ? res.data.name : null,
    };
  } catch {
    return null;
  }
}

function isRateLimited(communityId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (sendTimesByCommunity.get(communityId) || []).filter((t) => t > windowStart);

  if (recent.length >= RATE_LIMIT_BURST) {
    sendTimesByCommunity.set(communityId, recent);
    return true;
  }

  recent.push(now);
  sendTimesByCommunity.set(communityId, recent);
  return false;
}

function truncate(value, max) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function blockQuote(value) {
  return truncate(value, 1800)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

export async function sendCommunityPostToDiscord({ community, post }) {
  if (!community?.id || !community.discordWebhookUrl || !post) return;

  if (isRateLimited(community.id)) {
    console.warn(`Discord webhook rate limited for community ${community.slug || community.id}`);
    return;
  }

  const authorUsername = post.author?.username ? post.author.username : "unknown";
  const postLink = `${SHARE_BASE_URL}/c/${community.slug}/@${authorUsername}/post/${post.shortId || post.id}`;

  const embed = {
    color: 0x5865f2,
    description: post.content ? blockQuote(post.content) : "_no text_",
    fields: [
      { name: "Community", value: community.name, inline: true },
      { name: "Author", value: `@${authorUsername}`, inline: true },
      { name: "View post", value: postLink },
    ],
    timestamp: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
  };

  if (post.gifUrl) {
    embed.image = { url: post.gifUrl };
  } else if (post.mediaUrl && post.mediaType === "image") {
    embed.image = { url: post.mediaUrl };
  }

  const payload = {
    embeds: [embed],
    allowed_mentions: { parse: [] },
  };

  if (community.logoUrl && /^https:\/\//.test(community.logoUrl)) {
    payload.avatar_url = community.logoUrl;
    payload.username = truncate(community.name, 80);
  }

  try {
    await axios.post(community.discordWebhookUrl, payload, { timeout: 5000 });
  } catch (err) {
    console.error(
      `Discord webhook send failed for community ${community.slug || community.id}:`,
      err?.response?.data?.message || err?.message || err
    );
  }
}
