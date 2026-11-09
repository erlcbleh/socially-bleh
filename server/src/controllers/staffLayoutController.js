import { randomBytes } from "crypto";
import { prisma } from "../db/prisma.js";
import { newId, isValidObjectId } from "../lib/ids.js";
import { logStaffAction } from "../services/auditLog.js";
import { staffResourceChanged, STAFF_RESOURCES } from "../services/staffEvents.js";
import { parseName } from "../utils/staffPagination.js";

const LAYOUT_SCHEMA_VERSION = 1;
const MAX_NAME_LENGTH = 60;
const MAX_LAYOUTS_PER_USER = 30;

function serializeLayout(layout) {
  return {
    id: layout.id,
    name: layout.name,
    schemaVersion: layout.schemaVersion,
    layout: layout.layout,
    isPreset: layout.isPreset,
    isDefault: layout.isDefault,
    shareCode: layout.shareCode || null,
    createdBy: layout.createdBy ? { id: layout.createdBy.id, username: layout.createdBy.username } : null,
    updatedAt: layout.updatedAt,
  };
}

function parseLayoutBody(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!raw.grid || typeof raw.grid !== "object") return null;
  if (!raw.grid.root || typeof raw.grid.root !== "object") return null;
  if (!raw.panels || typeof raw.panels !== "object" || Array.isArray(raw.panels)) return null;
  if (Object.keys(raw.panels).length === 0) return null;
  return raw;
}

export async function listLayouts(req, res) {
  const [own, presets] = await Promise.all([
    prisma.staffLayout.findMany({
      where: { userId: req.staffUser.id },
      orderBy: { updatedAt: "desc" },
      take: MAX_LAYOUTS_PER_USER,
    }),
    prisma.staffLayout.findMany({
      where: { isPreset: true },
      orderBy: { updatedAt: "desc" },
      take: MAX_LAYOUTS_PER_USER,
      include: { createdBy: true },
    }),
  ]);

  res.json({
    layouts: own.map(serializeLayout),
    presets: presets.map(serializeLayout),
    schemaVersion: LAYOUT_SCHEMA_VERSION,
  });
}

export async function saveLayout(req, res) {
  const name = parseName(req.body.name, MAX_NAME_LENGTH);
  if (!name) return res.status(400).json({ message: "A layout name is required" });

  const layout = parseLayoutBody(req.body.layout);
  if (!layout) {
    return res.status(400).json({ message: "That layout is empty or malformed, so it wasn't saved." });
  }

  const existing = await prisma.staffLayout.findFirst({
    where: { userId: req.staffUser.id, name },
  });

  let ownedCount = 0;
  if (!existing) {
    ownedCount = await prisma.staffLayout.count({ where: { userId: req.staffUser.id } });
    if (ownedCount >= MAX_LAYOUTS_PER_USER) {
      return res.status(409).json({ message: `You can keep at most ${MAX_LAYOUTS_PER_USER} layouts.` });
    }
  }

  const saved = existing
    ? await prisma.staffLayout.update({
        where: { id: existing.id },
        data: { layout, schemaVersion: LAYOUT_SCHEMA_VERSION },
      })
    : await prisma.staffLayout.create({
        data: {
          id: newId(),
          userId: req.staffUser.id,
          name,
          layout,
          schemaVersion: LAYOUT_SCHEMA_VERSION,
          isDefault: ownedCount === 0,
        },
      });

  res.json({ layout: serializeLayout(saved) });
}

export async function renameLayout(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Layout not found" });

  const name = parseName(req.body.name, MAX_NAME_LENGTH);
  if (!name) return res.status(400).json({ message: "A layout name is required" });

  const layout = await prisma.staffLayout.findFirst({
    where: { id: req.params.id, userId: req.staffUser.id },
  });
  if (!layout) return res.status(404).json({ message: "Layout not found" });

  if (name !== layout.name) {
    const clash = await prisma.staffLayout.findFirst({
      where: { userId: req.staffUser.id, name, id: { not: layout.id } },
    });
    if (clash) return res.status(409).json({ message: "You already have a layout with that name." });
  }

  const renamed = await prisma.staffLayout.update({
    where: { id: layout.id },
    data: { name },
  });

  res.json({ layout: serializeLayout(renamed) });
}

export async function setDefaultLayout(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Layout not found" });

  const layout = await prisma.staffLayout.findFirst({
    where: { id: req.params.id, userId: req.staffUser.id },
  });
  if (!layout) return res.status(404).json({ message: "Layout not found" });

  await prisma.$transaction([
    prisma.staffLayout.updateMany({
      where: { userId: req.staffUser.id, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.staffLayout.update({ where: { id: layout.id }, data: { isDefault: true } }),
  ]);

  res.json({ ok: true });
}

export async function deleteLayout(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Layout not found" });

  const deleted = await prisma.staffLayout.deleteMany({
    where: { id: req.params.id, userId: req.staffUser.id },
  });
  if (deleted.count === 0) return res.status(404).json({ message: "Layout not found" });

  res.json({ ok: true });
}

const SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SHARE_CODE_LENGTH = 10;
const SHARE_CODE_ATTEMPTS = 5;

function generateShareCode() {
  const bytes = randomBytes(SHARE_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_ALPHABET[bytes[i] % SHARE_ALPHABET.length];
  }
  return code;
}

export function normalizeShareCode(raw) {
  const cleaned = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .filter((ch) => SHARE_ALPHABET.includes(ch))
    .join("");
  return cleaned.length === SHARE_CODE_LENGTH ? cleaned : null;
}

function uniqueName(existingNames, desired) {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;

  for (let n = 2; n < 100; n++) {
    const candidate = `${desired} (${n})`.slice(0, MAX_NAME_LENGTH);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${desired.slice(0, MAX_NAME_LENGTH - 6)} ${Date.now().toString().slice(-4)}`;
}

export async function createShareCode(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Layout not found" });

  const layout = await prisma.staffLayout.findFirst({
    where: { id: req.params.id, userId: req.staffUser.id },
  });
  if (!layout) return res.status(404).json({ message: "Layout not found" });

  if (layout.shareCode) {
    return res.json({ shareCode: layout.shareCode, name: layout.name });
  }

  for (let attempt = 0; attempt < SHARE_CODE_ATTEMPTS; attempt++) {
    const shareCode = generateShareCode();
    try {
      const updated = await prisma.staffLayout.update({
        where: { id: layout.id },
        data: { shareCode },
      });
      return res.json({ shareCode: updated.shareCode, name: updated.name });
    } catch (err) {
      if (err?.code !== "P2002") throw err;
    }
  }

  return res.status(500).json({ message: "Could not generate a share code, please try again." });
}

export async function revokeShareCode(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Layout not found" });

  const updated = await prisma.staffLayout.updateMany({
    where: { id: req.params.id, userId: req.staffUser.id },
    data: { shareCode: null },
  });
  if (updated.count === 0) return res.status(404).json({ message: "Layout not found" });

  res.json({ ok: true });
}

export async function previewSharedLayout(req, res) {
  const code = normalizeShareCode(req.params.code);
  if (!code) return res.status(404).json({ message: "That share code isn't valid." });

  const source = await prisma.staffLayout.findUnique({
    where: { shareCode: code },
    include: { user: { select: { username: true } } },
  });
  if (!source) return res.status(404).json({ message: "That share code isn't valid or was revoked." });

  const panelIds = Object.keys(source.layout?.panels || {});

  res.json({
    name: source.name,
    sharedBy: source.user?.username || null,
    panelIds,
    schemaVersion: source.schemaVersion,
  });
}

export async function importSharedLayout(req, res) {
  const code = normalizeShareCode(req.body?.code);
  if (!code) return res.status(400).json({ message: "That share code isn't valid." });

  const source = await prisma.staffLayout.findUnique({ where: { shareCode: code } });
  if (!source) return res.status(404).json({ message: "That share code isn't valid or was revoked." });

  const layout = parseLayoutBody(source.layout);
  if (!layout) return res.status(422).json({ message: "That shared layout is no longer usable." });

  const own = await prisma.staffLayout.findMany({
    where: { userId: req.staffUser.id },
    select: { name: true },
  });
  if (own.length >= MAX_LAYOUTS_PER_USER) {
    return res.status(409).json({ message: `You can keep at most ${MAX_LAYOUTS_PER_USER} layouts.` });
  }

  const requestedName = parseName(req.body?.name, MAX_NAME_LENGTH) || source.name;
  const name = uniqueName(own.map((row) => row.name), requestedName);

  const created = await prisma.staffLayout.create({
    data: {
      id: newId(),
      userId: req.staffUser.id,
      name,
      layout,
      schemaVersion: source.schemaVersion,
      isDefault: own.length === 0,
    },
  });

  res.json({ layout: serializeLayout(created) });
}

export async function shareLayoutAsPreset(req, res) {
  const name = parseName(req.body.name, MAX_NAME_LENGTH);
  if (!name) return res.status(400).json({ message: "A preset name is required" });

  const layout = parseLayoutBody(req.body.layout);
  if (!layout) {
    return res.status(400).json({ message: "That layout is empty or malformed, so it wasn't saved." });
  }

  const existing = await prisma.staffLayout.findFirst({ where: { isPreset: true, name } });

  const preset = existing
    ? await prisma.staffLayout.update({
        where: { id: existing.id },
        data: { layout, schemaVersion: LAYOUT_SCHEMA_VERSION, createdById: req.staffUser.id },
      })
    : await prisma.staffLayout.create({
        data: {
          id: newId(),
          userId: null,
          name,
          layout,
          schemaVersion: LAYOUT_SCHEMA_VERSION,
          isPreset: true,
          createdById: req.staffUser.id,
        },
      });

  await logStaffAction({
    staffId: req.staffUser.id,
    action: existing ? "update_layout_preset" : "share_layout_preset",
    targetType: "layout",
    targetId: preset.id,
    targetLabel: preset.name,
  });

  staffResourceChanged(STAFF_RESOURCES.layoutPresets, { id: preset.id, name: preset.name });

  res.json({ layout: serializeLayout(preset) });
}

export async function deletePreset(req, res) {
  if (!isValidObjectId(req.params.id)) return res.status(404).json({ message: "Preset not found" });

  const preset = await prisma.staffLayout.findFirst({ where: { id: req.params.id, isPreset: true } });
  if (!preset) return res.status(404).json({ message: "Preset not found" });

  await prisma.staffLayout.delete({ where: { id: preset.id } });

  await logStaffAction({
    staffId: req.staffUser.id,
    action: "delete_layout_preset",
    targetType: "layout",
    targetId: preset.id,
    targetLabel: preset.name,
  });

  staffResourceChanged(STAFF_RESOURCES.layoutPresets, { id: preset.id, deleted: true });

  res.json({ ok: true });
}
