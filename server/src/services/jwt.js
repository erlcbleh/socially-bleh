import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signToken(userId, tokenVersion = 0, { actorId } = {}) {
  const payload = { sub: userId, v: tokenVersion };
  if (actorId && actorId !== userId) payload.actor = actorId;
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}
