import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function submitRequest(req, res) {
  const { infringingUrls, goodFaithConfirmed, accuracyConfirmed } = req.body;
  const requesterName = String(req.body.requesterName || "").trim();
  const requesterEmail = String(req.body.requesterEmail || "").trim();
  const copyrightedWork = String(req.body.copyrightedWork || "").trim();
  const details = String(req.body.details || "").trim();
  const signature = String(req.body.signature || "").trim();

  const urls = Array.isArray(infringingUrls)
    ? infringingUrls.map((u) => String(u).trim()).filter(Boolean).filter(isHttpUrl).slice(0, 10)
    : [];

  if (!requesterName) return res.status(400).json({ message: "Your name is required" });
  if (!isValidEmail(requesterEmail)) return res.status(400).json({ message: "A valid email is required" });
  if (!copyrightedWork) return res.status(400).json({ message: "Describe the copyrighted work" });
  if (!urls.length) return res.status(400).json({ message: "At least one valid http(s) link to the infringing content is required" });
  if (!signature) return res.status(400).json({ message: "A signature is required" });
  if (!goodFaithConfirmed || !accuracyConfirmed) {
    return res.status(400).json({ message: "You must confirm both statements" });
  }

  const request = await prisma.copyrightRequest.create({
    data: {
      id: newId(),
      requesterName,
      requesterEmail,
      copyrightedWork,
      infringingUrls: urls,
      details,
      goodFaithConfirmed: true,
      accuracyConfirmed: true,
      signature,
    },
  });

  res.status(201).json({ id: request.id });
}
