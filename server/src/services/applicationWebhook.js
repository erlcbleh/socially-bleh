import axios from "axios";
import { env } from "../config/env.js";

const IS_COMPONENTS_V2 = 1 << 15;
const CONTAINER = 17;
const TEXT_DISPLAY = 10;
const SEPARATOR = 14;

export async function sendApplicationDecisionWebhook(application, reviewer) {
  if (!env.applicationWebhookUrl) return;

  const accepted = application.status === "accepted";

  const components = [
    {
      type: TEXT_DISPLAY,
      content: `## ${application.position}${application.department ? ` (${application.department})` : ""} Application`,
    },
    { type: TEXT_DISPLAY, content: `**User:** <@${application.discordId}>\n**Result:** ${accepted ? "Accepted" : "Rejected"}` },
  ];

  if (application.staffNote) {
    components.push({ type: SEPARATOR }, { type: TEXT_DISPLAY, content: `**Staff note**\n${application.staffNote}` });
  }

  const payload = {
    flags: IS_COMPONENTS_V2,
    allowed_mentions: { parse: ["users"] },
    components: [{ type: CONTAINER, components }],
  };

  try {
    await axios.post(`${env.applicationWebhookUrl}?with_components=true`, payload);
  } catch (err) {
    console.error("Application webhook failed", err.response?.data || err.message);
  }
}
