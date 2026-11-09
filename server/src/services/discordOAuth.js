import axios from "axios";
import { env } from "../config/env.js";

export function getDiscordAuthorizeUrl(state, redirectUri = env.discord.redirectUri) {
  const params = new URLSearchParams({
    client_id: env.discord.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(code, redirectUri = env.discord.redirectUri) {
  const params = new URLSearchParams({
    client_id: env.discord.clientId,
    client_secret: env.discord.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await axios.post("https://discord.com/api/oauth2/token", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const userRes = await axios.get("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
  });

  const discordUser = userRes.data;
  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.discriminator || "0") % 5}.png`;

  return {
    discordId: discordUser.id,
    discordUsername: discordUser.username,
    discordDisplayName: discordUser.global_name || discordUser.username,
    avatarUrl,
  };
}

export async function fetchDiscordUserAvatar(discordId) {
  if (!discordId) return null;

  
  if (env.discord.botToken) {
    try {
      const res = await axios.get(`https://discord.com/api/v10/users/${discordId}`, {
        headers: { Authorization: `Bot ${env.discord.botToken}` },
      });
      const discordUser = res.data;
      if (discordUser?.avatar) {
        return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
      }
      if (discordUser) {
        return `https://cdn.discordapp.com/embed/avatars/${Number(discordUser.discriminator || "0") % 5}.png`;
      }
    } catch (err) {
      console.warn("Failed to fetch Discord user via Bot token:", err?.response?.data || err.message);
    }
  }

  
  try {
    const res = await axios.get(`https://discord.com/api/v10/users/${discordId}`);
    const discordUser = res.data;
    if (discordUser?.avatar) {
      return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
    }
  } catch (err) {
    
  }

  return null;
}
