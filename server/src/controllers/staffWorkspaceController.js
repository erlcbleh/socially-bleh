import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { serializeUser } from "../services/hydrate.js";
import { parseName } from "../utils/staffPagination.js";

const MAX_NAME_LENGTH = 60;
const MAX_BODY_LENGTH = 5000;
const MAX_SAVED_SEARCHES = 50;
const NOTE_PAGE_SIZE = 50;

function serializeSearch(search) {
  return {
    id: search.id,
    name: search.name,
    panelId: search.panelId,
    query: search.query,
    isShared: search.isShared,
    owner: search.user ? serializeUser(search.user, {}) : null,
    updatedAt: search.updatedAt,
  };
}

function serializeNote(note) {
  return {
    id: note.id,
    body: note.body,
    targetType: note.targetType,
    targetId: note.targetId,
    pinned: note.pinned,
    author: note.author ? serializeUser(note.author, {}) : null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export async function listSavedSearches(req, res) {
  const panelId = typeof req.query.panelId === "string" ? req.query.panelId : null;

  const [own, shared] = await Promise.all([
    prisma.staffSavedSearch.findMany({
      where: { userId: req.staffUser.id, ...(panelId ? { panelId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: MAX_SAVED_SEARCHES,
    }),
    prisma.staffSavedSearch.findMany({
      where: {
        isShared: true,
        userId: { not: req.staffUser.id },
        ...(panelId ? { panelId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: MAX_SAVED_SEARCHES,
      include: { user: true },
    }),
  ]);

  res.json({ searches: own.map(serializeSearch), shared: shared.map(serializeSearch) });
}

export async function saveSearch(req, res) {
  const name = parseName(req.body?.name, MAX_NAME_LENGTH);
  if (!name) return res.status(400).json({ message: "A name is required." });

  const panelId = String(req.body?.panelId || "").trim();
  if (!panelId) return res.status(400).json({ message: "A panel is required." });

  const query = req.body?.query;
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    return res.status(400).json({ message: "A query object is required." });
  }

  const isShared = Boolean(req.body?.isShared);

  const existing = await prisma.staffSavedSearch.findFirst({
    where: { userId: req.staffUser.id, name },
  });

  if (!existing) {
    const count = await prisma.staffSavedSearch.count({ where: { userId: req.staffUser.id } });
    if (count >= MAX_SAVED_SEARCHES) {
      return res.status(409).json({ message: `You can keep at most ${MAX_SAVED_SEARCHES} saved searches.` });
    }
  }

  const saved = existing
    ? await prisma.staffSavedSearch.update({
        where: { id: existing.id },
        data: { panelId, query, isShared },
      })
    : await prisma.staffSavedSearch.create({
        data: { id: newId(), userId: req.staffUser.id, name, panelId, query, isShared },
      });

  res.json({ search: serializeSearch(saved) });
}

export async function deleteSavedSearch(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Saved search not found" });

  const deleted = await prisma.staffSavedSearch.deleteMany({
    where: { id: req.params.id, userId: req.staffUser.id },
  });
  if (deleted.count === 0) return res.status(404).json({ message: "Saved search not found" });

  res.json({ ok: true });
}

export async function listNotes(req, res) {
  const targetType = typeof req.query.targetType === "string" ? req.query.targetType : null;
  const targetId = typeof req.query.targetId === "string" ? req.query.targetId : null;
  const mine = req.query.mine === "true";

  const where = {
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
    ...(mine ? { authorId: req.staffUser.id } : {}),
  };

  const notes = await prisma.staffNote.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: NOTE_PAGE_SIZE,
    include: { author: true },
  });

  res.json({ notes: notes.map(serializeNote) });
}

export async function createNote(req, res) {
  const body = String(req.body?.body || "").trim().slice(0, MAX_BODY_LENGTH);
  if (!body) return res.status(400).json({ message: "A note body is required." });

  const targetType = req.body?.targetType ? String(req.body.targetType).slice(0, 40) : null;
  const rawTargetId = req.body?.targetId ? String(req.body.targetId) : null;
  const targetId = rawTargetId && isValidObjectId(rawTargetId) ? rawTargetId : null;

  const note = await prisma.staffNote.create({
    data: {
      id: newId(),
      authorId: req.staffUser.id,
      body,
      targetType,
      targetId,
      pinned: Boolean(req.body?.pinned),
    },
    include: { author: true },
  });

  res.status(201).json({ note: serializeNote(note) });
}

export async function updateNote(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Note not found" });

  const note = await prisma.staffNote.findUnique({ where: { id: req.params.id } });
  if (!note) return res.status(404).json({ message: "Note not found" });
  if (note.authorId !== req.staffUser.id) {
    return res.status(403).json({ message: "You can only edit your own notes." });
  }

  const data = {};
  if (typeof req.body?.body === "string") {
    const body = req.body.body.trim().slice(0, MAX_BODY_LENGTH);
    if (!body) return res.status(400).json({ message: "A note body is required." });
    data.body = body;
  }
  if (typeof req.body?.pinned === "boolean") data.pinned = req.body.pinned;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: "Nothing to update." });
  }

  const updated = await prisma.staffNote.update({
    where: { id: note.id },
    data,
    include: { author: true },
  });

  res.json({ note: serializeNote(updated) });
}

export async function deleteNote(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Note not found" });

  const note = await prisma.staffNote.findUnique({ where: { id: req.params.id } });
  if (!note) return res.status(404).json({ message: "Note not found" });

  const isOwner = note.authorId === req.staffUser.id;
  if (!isOwner && !req.staff?.isAdmin) {
    return res.status(403).json({ message: "You can only delete your own notes." });
  }

  await prisma.staffNote.delete({ where: { id: note.id } });

  res.json({ ok: true });
}
