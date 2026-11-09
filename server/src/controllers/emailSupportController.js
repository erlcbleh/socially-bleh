import { prisma } from "../db/prisma.js";
import { newId as generateId, isValidObjectId } from "../lib/ids.js";
import { roleLevel } from "../config/roles.js";
import { env } from "../config/env.js";
import { sendSupportEmail, authenticateInboundWebhook } from "../services/resendMailer.js";
import { uploadR2Buffer, getR2Object } from "../services/r2.js";
import { staffResourceChanged, STAFF_RESOURCES } from "../services/staffEvents.js";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_OUTBOUND_ATTACHMENTS = 10;
const OUTBOUND_ATTACHMENT_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function prepareOutboundAttachments(rawList) {
  if (rawList == null) return [];
  if (!Array.isArray(rawList)) throw { status: 400, message: "Attachments must be a list." };
  if (rawList.length > MAX_OUTBOUND_ATTACHMENTS) {
    throw { status: 400, message: `Attach at most ${MAX_OUTBOUND_ATTACHMENTS} images.` };
  }

  const prepared = [];
  for (const item of rawList) {
    const filename = String(item?.filename || "image").slice(0, 255);
    const mimeType = String(item?.contentType || item?.mimeType || "").toLowerCase();
    const base64 = typeof item?.data === "string" ? item.data.replace(/^data:[^;]+;base64,/, "") : "";

    if (!OUTBOUND_ATTACHMENT_TYPES.has(mimeType)) {
      throw { status: 400, message: "Only PNG, JPEG, GIF, or WebP images can be attached." };
    }
    if (!base64) throw { status: 400, message: "Attachment data is missing." };

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_BYTES) {
      throw { status: 400, message: "Each image must be under 15MB." };
    }

    prepared.push({ filename, mimeType, buffer, base64 });
  }
  return prepared;
}

function toResendAttachments(prepared) {
  return prepared.map((att) => ({ filename: att.filename, content: att.base64 }));
}

async function persistOutboundAttachments(emailId, conversationId, prepared) {
  for (const att of prepared) {
    const safeName = att.filename.replace(/[^\w.\-]+/g, "_");
    const key = `email-attachments/${conversationId}/${generateId()}_${safeName}`;
    try {
      await uploadR2Buffer({ key, buffer: att.buffer, contentType: att.mimeType });
      await prisma.attachment.create({
        data: { id: generateId(), emailId, filename: att.filename, mimeType: att.mimeType, size: att.buffer.length, storagePath: key },
      });
    } catch (err) {
      console.error("Failed to store outbound attachment", att.filename, err.message);
    }
  }
}

function normalizeAddress(value) {
  if (!value) return "";
  if (typeof value === "object") return normalizeAddress(value.email || value.address || "");
  const str = String(value);
  const angle = str.match(/<([^>]+)>/);
  return (angle ? angle[1] : str).trim().toLowerCase();
}

function normalizeList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map(normalizeAddress).filter(Boolean))];
}

async function storeAttachments(emailId, conversationId, attachments) {
  for (const attachment of attachments) {
    const base64 = attachment?.content || attachment?.data;
    const filename = String(attachment?.filename || attachment?.name || "attachment").slice(0, 255);
    const mimeType = attachment?.content_type || attachment?.contentType || "application/octet-stream";
    if (!base64 || typeof base64 !== "string") continue;

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_BYTES) continue;

    const safeName = filename.replace(/[^\w.\-]+/g, "_");
    const key = `email-attachments/${conversationId}/${generateId()}_${safeName}`;

    try {
      await uploadR2Buffer({ key, buffer, contentType: mimeType });
      await prisma.attachment.create({
        data: { id: generateId(), emailId, filename, mimeType, size: buffer.length, storagePath: key },
      });
    } catch (err) {
      console.error("Failed to store email attachment", filename, err.message);
    }
  }
}

const CONVERSATION_STATUSES = ["open", "claimed", "pending_staff", "waiting_customer", "resolved", "closed"];

function actor(req) {
  return { id: req.staffUser.id, isAdmin: Boolean(req.staff?.isAdmin), role: req.staff?.role || "user" };
}

function validateAdmin(staff) {
  if (!staff.isAdmin) {
    throw { status: 403, message: "Admin access required" };
  }
}

function canOverrideClaim(staff) {
  return roleLevel(staff.role) > roleLevel("admin");
}

function ensureOwner(conversation, staff) {
  if (canOverrideClaim(staff)) return;
  if (!conversation.claimedBy) {
    throw { status: 403, message: "Claim this conversation before acting on it." };
  }
  if (conversation.claimedBy !== staff.id) {
    throw { status: 403, message: "Only the assigned staff member may act on this conversation." };
  }
}

function requireConversationId(req) {
  const id = req.params.id;
  if (!isValidObjectId(id)) throw { status: 404, message: "Conversation not found" };
  return id;
}

function notifyEmailChange(meta = {}) {
  staffResourceChanged(STAFF_RESOURCES.emailSupport, meta);
}

const DEFAULT_MAILBOX = "support";
const MAILBOXES = {
  support: { key: "support", label: "Support", address: env.email.supportAddress, minLevel: roleLevel("admin"), compose: false },
  legal: { key: "legal", label: "Legal", address: env.email.legalAddress, minLevel: roleLevel("developer"), compose: true },
};

const EMAIL_ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mailboxConfig(key) {
  return MAILBOXES[key] || MAILBOXES[DEFAULT_MAILBOX];
}

function canAccessMailbox(staff, key) {
  const mailbox = MAILBOXES[key];
  if (!mailbox) return false;
  return roleLevel(staff.role) >= mailbox.minLevel;
}

function ensureMailboxAccess(staff, key) {
  if (!canAccessMailbox(staff, key)) {
    throw { status: 403, message: "You do not have access to this mailbox." };
  }
}

function accessibleMailboxes(staff) {
  return Object.values(MAILBOXES)
    .filter((mailbox) => roleLevel(staff.role) >= mailbox.minLevel)
    .map((mailbox) => ({ key: mailbox.key, label: mailbox.label, address: mailbox.address, compose: mailbox.compose }));
}

function mailboxForAddresses(addresses) {
  const set = new Set((addresses || []).map((address) => String(address).toLowerCase()));
  for (const mailbox of Object.values(MAILBOXES)) {
    if (set.has(mailbox.address)) return mailbox.key;
  }
  return DEFAULT_MAILBOX;
}

export async function listConversations(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const { status, search, limit = 30, cursor, mailbox } = req.query;
  const numLimit = Math.min(100, Math.max(1, Number(limit) || 30));

  const mailboxKey = typeof mailbox === "string" && MAILBOXES[mailbox] ? mailbox : DEFAULT_MAILBOX;
  ensureMailboxAccess(staff, mailboxKey);

  const where = { mailbox: mailboxKey };
  if (status === "unread") {
    where.emails = { some: { direction: "inbound", read: false } };
  } else if (status && CONVERSATION_STATUSES.includes(status)) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  if (cursor) {
    where.id = { lt: cursor };
  }

  const conversations = await prisma.emailConversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: numLimit + 1,
    include: {
      claimStaff: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      emails: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { internalNotes: true, emails: true } },
    },
  });

  const hasNext = conversations.length > numLimit;
  if (hasNext) conversations.pop();

  const ids = conversations.map((conv) => conv.id);
  const [unreadGroups, attachmentConversations] = await Promise.all([
    ids.length
      ? prisma.email.groupBy({
          by: ["conversationId"],
          where: { conversationId: { in: ids }, direction: "inbound", read: false },
          _count: { _all: true },
        })
      : [],
    ids.length
      ? prisma.email.findMany({
          where: { conversationId: { in: ids }, attachments: { some: {} } },
          select: { conversationId: true },
          distinct: ["conversationId"],
        })
      : [],
  ]);

  const unreadMap = new Map(unreadGroups.map((group) => [group.conversationId, group._count._all]));
  const attachmentSet = new Set(attachmentConversations.map((email) => email.conversationId));

  const items = conversations.map((conv) => ({
    id: conv.id,
    subject: conv.subject,
    status: conv.status,
    customerEmail: conv.customerEmail,
    claimedBy: conv.claimStaff,
    claimedAt: conv.claimedAt,
    lastMessageAt: conv.lastMessageAt,
    createdAt: conv.createdAt,
    emailCount: conv._count.emails,
    notesCount: conv._count.internalNotes,
    unreadCount: unreadMap.get(conv.id) || 0,
    hasAttachments: attachmentSet.has(conv.id),
  }));

  res.json({
    items,
    nextCursor: hasNext ? conversations[conversations.length - 1].id : null,
    mailbox: mailboxKey,
    mailboxes: accessibleMailboxes(staff),
  });
}

export async function getConversation(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
    include: {
      claimStaff: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      emails: {
        orderBy: { createdAt: "asc" },
        include: { attachments: true },
      },
      internalNotes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      },
      drafts: {
        include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      },
    },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  const unread = conversation.emails.filter((email) => email.direction === "inbound" && !email.read);
  if (unread.length > 0) {
    await prisma.email.updateMany({
      where: { conversationId: conversation.id, direction: "inbound", read: false },
      data: { read: true },
    });
    for (const email of unread) email.read = true;
    notifyEmailChange({ conversationId: conversation.id, reason: "read" });
  }

  res.json({
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status,
    customerEmail: conversation.customerEmail,
    claimedBy: conversation.claimStaff,
    claimedAt: conversation.claimedAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    emails: conversation.emails,
    internalNotes: conversation.internalNotes,
    drafts: conversation.drafts,
  });
}

export async function claimConversation(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  if (conversation.claimedBy) {
    return res.status(409).json({ message: "Conversation already claimed" });
  }

  const updated = await prisma.emailConversation.update({
    where: { id: req.params.id },
    data: {
      claimedBy: staff.id,
      claimedAt: new Date(),
      status: "claimed",
    },
    include: {
      claimStaff: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId: req.params.id,
      staffId: staff.id,
      action: "claimed",
    },
  });

  notifyEmailChange({ conversationId: req.params.id, reason: "claimed" });
  res.json(updated);
}

export async function unclaimConversation(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  if (conversation.claimedBy && conversation.claimedBy !== staff.id && !canOverrideClaim(staff)) {
    return res
      .status(403)
      .json({ message: "Only the assigned staff member or a higher administrator may release this claim." });
  }

  const updated = await prisma.emailConversation.update({
    where: { id: req.params.id },
    data: {
      claimedBy: null,
      claimedAt: null,
      status: "open",
    },
    include: {
      claimStaff: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId: req.params.id,
      staffId: staff.id,
      action: "unclaimed",
    },
  });

  notifyEmailChange({ conversationId: req.params.id, reason: "unclaimed" });
  res.json(updated);
}

export async function updateConversationStatus(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const { status } = req.body;
  if (!CONVERSATION_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  ensureOwner(conversation, staff);

  const updated = await prisma.emailConversation.update({
    where: { id: req.params.id },
    data: { status },
    include: {
      claimStaff: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId: req.params.id,
      staffId: staff.id,
      action: "status_changed",
      details: { newStatus: status },
    },
  });

  notifyEmailChange({ conversationId: req.params.id, reason: "status" });
  res.json(updated);
}

export async function addInternalNote(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const { content } = req.body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ message: "Content required" });
  }

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  ensureOwner(conversation, staff);

  const note = await prisma.internalNote.create({
    data: {
      id: generateId(),
      conversationId: req.params.id,
      authorId: staff.id,
      content: content.trim(),
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId: req.params.id,
      staffId: staff.id,
      action: "note_added",
    },
  });

  res.json(note);
}

export async function saveDraft(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const { content } = req.body;
  if (!content || typeof content !== "string") {
    return res.status(400).json({ message: "Content required" });
  }

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  const draft = await prisma.emailDraft.upsert({
    where: {
      conversationId_authorId: {
        conversationId: req.params.id,
        authorId: staff.id,
      },
    },
    update: { content },
    create: {
      id: generateId(),
      conversationId: req.params.id,
      authorId: staff.id,
      content,
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  res.json(draft);
}

export async function deleteDraft(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  await prisma.emailDraft.deleteMany({
    where: {
      conversationId: req.params.id,
      authorId: staff.id,
    },
  });

  res.json({ success: true });
}

export async function composeEmail(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const { mailbox: mailboxKey, to, subject, body } = req.body;

  const key = typeof mailboxKey === "string" && MAILBOXES[mailboxKey] ? mailboxKey : null;
  if (!key) {
    return res.status(400).json({ message: "Unknown mailbox" });
  }

  ensureMailboxAccess(staff, key);

  const mailbox = MAILBOXES[key];
  if (!mailbox.compose) {
    return res.status(403).json({ message: "This mailbox does not support composing new emails." });
  }

  const toAddress = normalizeAddress(to);
  if (!EMAIL_ADDRESS_RE.test(toAddress)) {
    return res.status(400).json({ message: "A valid recipient email address is required." });
  }

  const cleanSubject = typeof subject === "string" ? subject.trim() : "";
  if (!cleanSubject) {
    return res.status(400).json({ message: "Subject is required." });
  }

  const cleanBody = typeof body === "string" ? body.trim() : "";
  if (!cleanBody) {
    return res.status(400).json({ message: "Message body is required." });
  }

  let attachments;
  try {
    attachments = prepareOutboundAttachments(req.body.attachments);
  } catch (error) {
    return res.status(error?.status || 400).json({ message: error?.message || "Invalid attachment." });
  }

  const fromAddress = mailbox.address;

  let providerId = null;
  try {
    const sent = await sendSupportEmail({
      from: fromAddress,
      to: [toAddress],
      subject: cleanSubject,
      text: cleanBody,
      attachments: toResendAttachments(attachments),
    });
    providerId = sent.id;
  } catch (error) {
    const errorCode = error?.code || "mailer_error";
    const errorStatus = errorCode === "mailer_unconfigured" ? 503 : error?.status || 502;
    const errorMessage = error?.message || "Failed to send email";

    console.error("[email-compose] send failed", {
      mailbox: key,
      code: errorCode,
      status: error?.status || null,
      message: errorMessage,
    });

    return res.status(errorStatus).json({ message: errorMessage });
  }

  const conversationId = generateId();
  const emailId = generateId();
  const messageId = providerId || `${emailId}@${fromAddress.split("@")[1] || "socially.lol"}`;
  const now = new Date();

  await prisma.emailConversation.create({
    data: {
      id: conversationId,
      subject: cleanSubject,
      customerEmail: toAddress,
      mailbox: key,
      status: "waiting_customer",
      claimedBy: staff.id,
      claimedAt: now,
      lastMessageAt: now,
    },
  });

  await prisma.email.create({
    data: {
      id: emailId,
      messageId,
      conversationId,
      direction: "outbound",
      from: fromAddress,
      to: [toAddress],
      cc: [],
      bcc: [],
      subject: cleanSubject,
      text: cleanBody,
      headers: { providerId },
      sentAt: now,
      deliveryStatus: "sent",
    },
  });

  await persistOutboundAttachments(emailId, conversationId, attachments);

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId,
      staffId: staff.id,
      action: "conversation_created",
      details: { composed: true, to: toAddress, subject: cleanSubject, providerId, attachments: attachments.length },
    },
  });

  notifyEmailChange({ conversationId, reason: "composed" });
  res.status(201).json({ conversationId });
}

export async function sendReply(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const { content, isReplyAll } = req.body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ message: "Content required" });
  }

  let attachments;
  try {
    attachments = prepareOutboundAttachments(req.body.attachments);
  } catch (error) {
    return res.status(error?.status || 400).json({ message: error?.message || "Invalid attachment." });
  }

  const conversation = await prisma.emailConversation.findUnique({
    where: { id: req.params.id },
    include: { emails: { where: { direction: "inbound" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!conversation) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  ensureMailboxAccess(staff, conversation.mailbox);

  ensureOwner(conversation, staff);

  const lastInbound = conversation.emails[0];
  if (!lastInbound) {
    return res.status(400).json({ message: "There is no customer email to reply to." });
  }

  const fromAddress = mailboxConfig(conversation.mailbox).address;
  const to = [conversation.customerEmail];
  const cc = isReplyAll
    ? [...new Set((lastInbound.cc || []).filter((address) => address && address !== conversation.customerEmail && address !== fromAddress))]
    : [];

  const subject = /^re:/i.test(conversation.subject) ? conversation.subject : `Re: ${conversation.subject}`;
  const previousReferences =
    typeof lastInbound.headers?.references === "string" ? lastInbound.headers.references : "";
  const references = `${previousReferences} ${lastInbound.messageId}`.trim();
  const wireHeaders = { "In-Reply-To": lastInbound.messageId, References: references };

  let providerId = null;
  try {
    const sent = await sendSupportEmail({
      from: fromAddress,
      to,
      cc,
      subject,
      text: content.trim(),
      headers: wireHeaders,
      attachments: toResendAttachments(attachments),
    });
    providerId = sent.id;
  } catch (error) {
    const errorCode = error?.code || "mailer_error";
    const errorStatus = errorCode === "mailer_unconfigured" ? 503 : error?.status || 502;
    const errorMessage = error?.message || "Failed to send reply";

    console.error("[email-reply] send failed", {
      conversationId: req.params.id,
      code: errorCode,
      status: error?.status || null,
      message: errorMessage,
    });

    await prisma.emailAuditLog.create({
      data: {
        id: generateId(),
        conversationId: req.params.id,
        staffId: staff.id,
        action: "reply_failed",
        details: { message: errorMessage, code: errorCode, status: errorStatus },
      },
    });
    notifyEmailChange({ conversationId: req.params.id, reason: "reply_failed" });
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const emailId = generateId();
  const messageId = providerId || `${emailId}@${fromAddress.split("@")[1] || "socially.lol"}`;

  const sentEmail = await prisma.email.create({
    data: {
      id: emailId,
      messageId,
      conversationId: req.params.id,
      direction: "outbound",
      from: fromAddress,
      to,
      cc,
      bcc: [],
      subject,
      text: content.trim(),
      headers: { ...wireHeaders, providerId },
      sentAt: new Date(),
      deliveryStatus: "sent",
    },
    include: { attachments: true },
  });

  await persistOutboundAttachments(emailId, req.params.id, attachments);
  if (attachments.length) {
    sentEmail.attachments = await prisma.attachment.findMany({ where: { emailId } });
  }

  await prisma.emailConversation.update({
    where: { id: req.params.id },
    data: { lastMessageAt: new Date(), status: "waiting_customer" },
  });

  await prisma.emailDraft.deleteMany({
    where: { conversationId: req.params.id, authorId: staff.id },
  });

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId: req.params.id,
      staffId: staff.id,
      action: "reply_sent",
      details: { emailId, isReplyAll: Boolean(isReplyAll), providerId, attachments: attachments.length },
    },
  });

  notifyEmailChange({ conversationId: req.params.id, reason: "reply_sent" });
  res.status(201).json({ email: sentEmail });
}

export async function handleResendWebhook(req, res) {
  const authOk = authenticateInboundWebhook(req.rawBody, req.headers);
  console.log("[email-webhook] received", {
    authOk,
    hasToken: Boolean(env.email.inboundToken),
    hasSvixSecret: Boolean(env.email.webhookSecret),
    hasBearer: String(req.headers["authorization"] || "").startsWith("Bearer "),
    svixId: req.headers["svix-id"] || null,
    contentLength: req.headers["content-length"] || null,
    type: req.body?.type || null,
  });

  if (!authOk) {
    console.warn("[email-webhook] rejected: authentication failed");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const event = req.body?.data && typeof req.body.data === "object" ? req.body.data : req.body || {};

  const headers = event.headers && typeof event.headers === "object" ? event.headers : {};
  const messageId =
    event.email_id ||
    event.messageId ||
    event.message_id ||
    event.id ||
    headers["message-id"] ||
    headers["Message-ID"] ||
    `inbound-${generateId()}`;
  const from = normalizeAddress(event.from);
  const to = normalizeList(event.to);
  const subject = String(event.subject || "(no subject)").slice(0, 500);
  const html = typeof event.html === "string" ? event.html : null;
  const text = typeof event.text === "string" ? event.text : null;
  const cc = normalizeList(event.cc || headers.cc);
  const receivedAt = event.created_at ? new Date(event.created_at) : new Date();
  const attachments = Array.isArray(event.attachments) ? event.attachments : [];

  if (!from || to.length === 0) {
    console.warn("[email-webhook] rejected: missing from/to", { from, to, eventKeys: Object.keys(event || {}) });
    return res.status(400).json({ message: "Missing required fields" });
  }

  const mailbox = mailboxForAddresses([...to, ...cc]);
  console.log("[email-webhook] parsed", {
    messageId,
    from,
    to,
    cc,
    mailbox,
    hasHtml: Boolean(html),
    hasText: Boolean(text),
    attachments: attachments.length,
  });

  const duplicate = await prisma.email.findUnique({ where: { messageId } });
  if (duplicate) {
    return res.json({ success: true, conversationId: duplicate.conversationId, duplicate: true });
  }

  let conversation = await prisma.emailConversation.findFirst({
    where: { customerEmail: from, mailbox, status: { not: "closed" } },
    orderBy: { lastMessageAt: "desc" },
  });

  const isNewConversation = !conversation;
  if (!conversation) {
    conversation = await prisma.emailConversation.create({
      data: { id: generateId(), subject, customerEmail: from, mailbox, status: "open" },
    });
  }

  const emailId = generateId();
  await prisma.email.create({
    data: {
      id: emailId,
      messageId,
      conversationId: conversation.id,
      direction: "inbound",
      from,
      to,
      cc,
      bcc: [],
      subject,
      html,
      text,
      headers,
      receivedAt,
      read: false,
      deliveryStatus: "delivered",
    },
  });

  await storeAttachments(emailId, conversation.id, attachments);

  await prisma.emailConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: receivedAt,
      ...(conversation.status === "waiting_customer" ? { status: "pending_staff" } : {}),
    },
  });

  await prisma.emailAuditLog.create({
    data: {
      id: generateId(),
      conversationId: conversation.id,
      action: isNewConversation ? "conversation_created" : "email_received",
      details: { from, subject, messageId },
    },
  });

  notifyEmailChange({ conversationId: conversation.id, reason: "received" });
  console.log("[email-webhook] stored", {
    conversationId: conversation.id,
    mailbox,
    isNewConversation,
    messageId,
  });
  res.json({ success: true, conversationId: conversation.id });
}

export async function downloadAttachment(req, res) {
  const staff = actor(req);
  validateAdmin(staff);

  const conversationId = requireConversationId(req);
  if (!isValidObjectId(req.params.attachmentId)) {
    return res.status(404).json({ message: "Attachment not found" });
  }

  const attachment = await prisma.attachment.findFirst({
    where: { id: req.params.attachmentId, email: { conversationId } },
  });

  if (!attachment) {
    return res.status(404).json({ message: "Attachment not found" });
  }

  try {
    const object = await getR2Object(attachment.storagePath);
    res.setHeader("Content-Type", attachment.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    if (object.contentLength) res.setHeader("Content-Length", String(object.contentLength));
    if (object.body && typeof object.body.pipe === "function") {
      object.body.pipe(res);
    } else {
      res.end(Buffer.from(await object.body.transformToByteArray()));
    }
  } catch (err) {
    console.error("Failed to download attachment", attachment.id, err.message);
    res.status(502).json({ message: "Attachment is unavailable." });
  }
}
