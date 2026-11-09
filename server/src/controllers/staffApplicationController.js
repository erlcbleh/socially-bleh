import crypto from "crypto";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { getDiscordAuthorizeUrl } from "../services/discordOAuth.js";
import { APPLICATION_IDENTITY_COOKIE, verifyApplicationIdentityToken } from "../services/applicationIdentity.js";
import { env } from "../config/env.js";

const OPEN_POSITIONS = ["Support"];
const DEPARTMENTS = ["Operations", "Community Management", "Support Management"];
const DEPARTMENT_REQUIRED_POSITIONS = ["High Rank"];

export function applicationDiscordRedirect(req, res) {
  const position = String(req.query.position || "").slice(0, 50);
  if (!OPEN_POSITIONS.includes(position)) return res.status(400).json({ message: "This position is not accepting applications" });

  const state = `app:${crypto.randomBytes(16).toString("hex")}`;
  const options = { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: "lax", secure: env.cookieSecure, path: "/" };
  res.cookie("app_oauth_state", state, options);
  res.cookie("app_oauth_position", position, options);
  res.redirect(getDiscordAuthorizeUrl(state));
}

export function getApplicationDiscordIdentity(req, res) {
  const token = req.cookies?.[APPLICATION_IDENTITY_COOKIE];
  if (!token) return res.json({ connected: false });

  try {
    const { discordUsername } = verifyApplicationIdentityToken(token);
    res.json({ connected: true, discordUsername });
  } catch {
    res.json({ connected: false });
  }
}

export async function submitApplication(req, res) {
  let discordId, discordUsername;
  try {
    ({ discordId, discordUsername } = verifyApplicationIdentityToken(req.cookies?.[APPLICATION_IDENTITY_COOKIE]));
  } catch {
    return res.status(401).json({ message: "Connect your Discord account first" });
  }

  const position = String(req.body.position || "").trim();
  const department = String(req.body.department || "").trim();
  const motivation = String(req.body.motivation || "").trim();
  const experience = String(req.body.experience || "").trim();
  const tosAgreed = req.body.tosAgreed === true;

  const scenarioResponses = Array.isArray(req.body.scenarioResponses)
    ? req.body.scenarioResponses.map((r) => ({
        question: String(r?.question || "").trim(),
        answer: String(r?.answer || "").trim(),
      }))
    : [];

  if (!OPEN_POSITIONS.includes(position)) return res.status(400).json({ message: "Select a valid position" });
  if (DEPARTMENT_REQUIRED_POSITIONS.includes(position) && !DEPARTMENTS.includes(department)) {
    return res.status(400).json({ message: "Select a valid department" });
  }
  if (!motivation) return res.status(400).json({ message: "Tell us why you'd be a good fit" });
  if (!scenarioResponses.length || scenarioResponses.some((r) => !r.question || !r.answer)) {
    return res.status(400).json({ message: "Answer all scenario questions" });
  }
  if (!tosAgreed) return res.status(400).json({ message: "You must agree to the Terms of Service and Privacy Policy" });

  const application = await prisma.staffApplication.create({
    data: {
      id: newId(),
      discordId,
      discordUsername,
      position,
      department: DEPARTMENT_REQUIRED_POSITIONS.includes(position) ? department : null,
      motivation,
      experience,
      scenarioResponses,
      tosAgreed,
    },
  });

  res.status(201).json({ id: application.id });
}
