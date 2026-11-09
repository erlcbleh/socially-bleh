import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const APPLICATION_IDENTITY_COOKIE = "application_discord";

const applicationSecret = crypto
  .createHash("sha256")
  .update(`${env.jwtSecret}:application:v1`)
  .digest("hex");

export function signApplicationIdentityToken(discordId, discordUsername) {
  return jwt.sign({ discordId, discordUsername, typ: "application" }, applicationSecret, { expiresIn: "30m" });
}

export function verifyApplicationIdentityToken(token) {
  const payload = jwt.verify(token, applicationSecret);
  if (payload.typ !== "application") throw new Error("Invalid application identity token");
  return payload;
}
