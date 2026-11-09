import crypto from "crypto";
import { env } from "../config/env.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;

export function isMailerConfigured() {
  return Boolean(env.email.resendApiKey);
}

function isTransient(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendSupportEmail({ from, to, cc = [], bcc = [], subject, text, html, headers = {}, attachments = [] }) {
  if (!isMailerConfigured()) {
    throw Object.assign(new Error("Email sending is not configured (RESEND_API_KEY is unset)."), {
      code: "mailer_unconfigured",
    });
  }

  const payload = {
    from,
    to,
    subject,
    ...(cc.length ? { cc } : {}),
    ...(bcc.length ? { bcc } : {}),
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
    ...(attachments.length ? { attachments } : {}),
  };

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.email.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_BASE_MS * attempt);
        continue;
      }
      throw Object.assign(new Error("Failed to reach the email provider."), {
      code: "mailer_unreachable",
      status: 502
    });
    }

    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      return { id: body.id || null };
    }

    const body = await res.json().catch(() => ({}));
    const message = body?.message || `Email provider returned ${res.status}`;

    if (isTransient(res.status) && attempt < MAX_ATTEMPTS) {
      lastError = Object.assign(new Error(message), {
        code: "mailer_error",
        status: res.status
      });
      await sleep(RETRY_BASE_MS * attempt);
      continue;
    }

    throw Object.assign(new Error(message), {
      code: "mailer_rejected",
      status: res.status
    });
  }

  const finalError = lastError || new Error("Email provider did not accept the message.");
  if (!finalError.code) {
    finalError.code = "mailer_error";
    finalError.status = 502;
  }
  throw finalError;
}

export function authenticateInboundWebhook(rawBody, reqHeaders) {
  const token = env.email.inboundToken;
  const svixSecret = env.email.webhookSecret;

  if (!token && !svixSecret) return false;

  if (token) {
    const header = String(reqHeaders["authorization"] || "");
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (
      provided &&
      provided.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))
    ) {
      return true;
    }
  }

  if (svixSecret && verifyResendWebhook(rawBody, reqHeaders)) return true;

  return false;
}

export function verifyResendWebhook(rawBody, reqHeaders) {
  const secret = env.email.webhookSecret;
  if (!secret) return false;

  const id = reqHeaders["svix-id"];
  const timestamp = reqHeaders["svix-timestamp"];
  const signatureHeader = reqHeaders["svix-signature"];

  if (!id || !timestamp || !signatureHeader || !rawBody) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const provided = String(signatureHeader)
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter(Boolean);

  const expectedBuf = Buffer.from(expected);
  return provided.some((candidate) => {
    const candidateBuf = Buffer.from(candidate);
    return candidateBuf.length === expectedBuf.length && crypto.timingSafeEqual(candidateBuf, expectedBuf);
  });
}
