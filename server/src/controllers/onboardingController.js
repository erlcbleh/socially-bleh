import { prisma } from "../db/prisma.js";
import { hydrateUser } from "../services/hydrate.js";
import {
  USERNAME_RE,
  isReserved,
  normalizeUsername,
  isUsernameTaken,
  isBlockedUsername,
  USERNAME_BLOCKED_MESSAGE,
} from "../services/username.js";

export const INTEREST_TAGS = [
  "Law Enforcement RP",
  "Fire/EMS RP",
  "Civilian RP",
  "DOT/Infrastructure",
  "Racing",
  "Content Creation",
  "Moderation/Staffing",
  "Dispatch/Comms",
  "Realistic Roleplay",
];

export async function checkUsername(req, res) {
  const username = normalizeUsername(req.query.u);
  if (!USERNAME_RE.test(username) || isReserved(username) || isBlockedUsername(username)) {
    return res.json({ available: false });
  }
  res.json({ available: !(await isUsernameTaken(username, req.user.id)) });
}

export async function setUsername(req, res) {
  const username = normalizeUsername(req.body.username);
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ message: "Username must be 3-20 characters, letters/numbers/underscore only, and can't start or end with an underscore." });
  }
  if (isReserved(username)) {
    return res.status(400).json({ message: "That username is reserved." });
  }
  if (isBlockedUsername(username)) {
    return res.status(400).json({ message: USERNAME_BLOCKED_MESSAGE });
  }

  if (await isUsernameTaken(username, req.user.id)) {
    return res.status(409).json({ message: "That username is taken." });
  }

  const data = { username };
  if (!req.user.displayName) data.displayName = username;
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  req.user = user;

  res.json({ user: await hydrateUser(user, user.id) });
}

export async function setInterests(req, res) {
  const interests = Array.isArray(req.body.interests)
    ? [...new Set(req.body.interests.slice(0, 100).filter((i) => INTEREST_TAGS.includes(i)))]
    : [];
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { interests } });
  req.user = user;
  res.json({ user: await hydrateUser(user, user.id) });
}

export function listInterestTags(req, res) {
  res.json({ tags: INTEREST_TAGS });
}

export async function completeOnboarding(req, res) {
  if (!req.user.username) {
    return res.status(400).json({ message: "Choose a username before completing onboarding." });
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { onboardingComplete: true } });
  req.user = user;
  res.json({ user: await hydrateUser(user, user.id) });
}

export async function markPromoVideoSeen(req, res) {
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { hasSeenPromoVideo: true } });
  req.user = user;
  res.json({ user: await hydrateUser(user, user.id) });
}
