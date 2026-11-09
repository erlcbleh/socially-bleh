import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { searchLimiter } from "../middleware/rateLimit.js";
import { searchGiphy, fetchGiphyTrending, isGiphyUrl } from "../services/giphy.js";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";

const router = Router();
router.use(requireAuth, requireActiveAccount);

router.get("/search", searchLimiter, asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    const results = await fetchGiphyTrending();
    return res.json({ results });
  }
  const results = await searchGiphy(q);
  res.json({ results });
}));

router.get("/favorites", asyncHandler(async (req, res) => {
  const favorites = await prisma.favoriteGif.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    results: favorites.map((f) => ({ id: f.gifId, url: f.url, previewUrl: f.previewUrl, description: f.description })),
  });
}));

router.post("/favorites", asyncHandler(async (req, res) => {
  const gifId = String(req.body.id || "").trim();
  const url = String(req.body.url || "").trim();
  const previewUrl = String(req.body.previewUrl || "").trim();
  const description = String(req.body.description || "").trim().slice(0, 200);
  if (!gifId || !url || !previewUrl || !isGiphyUrl(url) || !isGiphyUrl(previewUrl)) {
    return res.status(400).json({ message: "Invalid GIF" });
  }

  const existing = await prisma.favoriteGif.findUnique({
    where: { userId_gifId: { userId: req.user.id, gifId } },
  });
  if (existing) {
    await prisma.favoriteGif.update({
      where: { id: existing.id },
      data: { url, previewUrl, description },
    });
  } else {
    await prisma.favoriteGif.create({
      data: {
        id: newId(),
        userId: req.user.id,
        gifId,
        url,
        previewUrl,
        description,
      },
    });
  }
  res.status(201).json({ ok: true });
}));

router.delete("/favorites/:gifId", asyncHandler(async (req, res) => {
  await prisma.favoriteGif.deleteMany({
    where: { userId: req.user.id, gifId: req.params.gifId },
  });
  res.json({ ok: true });
}));

export default router;
