import axios from "axios";
import { env } from "../config/env.js";

export const BUSINESS_MIN_MEMBERS = 500;

const INVITE_HOSTS = ["discord.gg", "discord.com", "discordapp.com", "www.discord.gg", "ptb.discord.com", "canary.discord.com"];
const CODE_RE = /^[a-zA-Z0-9-]{2,64}$/;
const REQUEST_TIMEOUT_MS = 8000;

export function parseInviteCode(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;

  if (CODE_RE.test(value) && !value.includes("/") && !value.includes(".")) return value;

  let url;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!INVITE_HOSTS.includes(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const code = host.endsWith("discord.gg") ? segments[0] : segments[0] === "invite" ? segments[1] : null;

  return code && CODE_RE.test(code) ? code : null;
}

function iconUrl(guild) {
  if (!guild?.icon) return "";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`;
}

async function fetchGuildCounts(guildId) {
  if (!env.discord.botToken || !guildId) return null;

  try {
    const res = await axios.get(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${env.discord.botToken}` },
      timeout: REQUEST_TIMEOUT_MS,
    });
    return res.data || null;
  } catch {
    return null;
  }
}

export async function resolveDiscordInvite(raw) {
  const code = parseInviteCode(raw);
  if (!code) {
    return {
      ok: false,
      reason: "invalid_invite",
      message: "Enter a Discord invite link, for example https://discord.gg/yourserver.",
    };
  }

  let invite;
  try {
    const res = await axios.get(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`,
      { timeout: REQUEST_TIMEOUT_MS }
    );
    invite = res.data;
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        ok: false,
        reason: "invalid_invite",
        message: "That invite is invalid or has expired. Use a permanent invite that never expires.",
      };
    }
    console.error("Discord invite lookup failed", err.response?.status, err.message);
    return {
      ok: false,
      reason: "lookup_failed",
      message: "We couldn't reach Discord to check that invite. Please try again in a moment.",
    };
  }

  if (!invite?.guild?.id) {
    return {
      ok: false,
      reason: "not_a_server",
      message: "That invite doesn't point to a Discord server.",
    };
  }
  if (invite.expires_at) {
    return {
      ok: false,
      reason: "temporary_invite",
      message: "That invite expires. Create a permanent invite (Expire after: Never) so staff can verify it.",
    };
  }

  const guild = await fetchGuildCounts(invite.guild.id);

  return {
    ok: true,
    code,
    inviteUrl: `https://discord.gg/${code}`,
    guildId: invite.guild.id,
    guildName: invite.guild.name || "",
    guildIconUrl: iconUrl(invite.guild),
    memberCount: guild?.approximate_member_count ?? invite.approximate_member_count ?? 0,
    presenceCount: guild?.approximate_presence_count ?? invite.approximate_presence_count ?? 0,
    source: guild ? "guild" : "invite",
  };
}

export function meetsMemberRequirement(memberCount) {
  return Number(memberCount || 0) >= BUSINESS_MIN_MEMBERS;
}
