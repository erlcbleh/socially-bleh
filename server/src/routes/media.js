import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { env } from "../config/env.js";
import { signUpload } from "../services/cloudinary.js";
import { createPresignedUpload, isOwnMediaUrl } from "../services/r2.js";
import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";

const router = Router();
router.use(requireAuth, requireActiveAccount, uploadLimiter);

router.post("/presign", asyncHandler(async (req, res) => {
  const { contentType } = req.body;
  if (!env.r2.accountId || !env.r2.accessKeyId) {
    return res.status(500).json({ message: "R2 storage is not configured." });
  }

  if (typeof contentType !== "string") {
    return res.status(400).json({ message: "contentType is required" });
  }

  try {
    const presigned = await createPresignedUpload({
      userId: req.user.id,
      contentType,
    });
    res.json(presigned);
  } catch (err) {
    if (err.message === "Invalid content type") {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
}));

router.post("/register", asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (typeof url !== "string" || url.length > 500 || !isOwnMediaUrl(url)) {
    return res.status(400).json({ message: "Invalid upload URL" });
  }

  await prisma.pendingUpload.create({
    data: {
      id: newId(),
      userId: req.user.id,
      url,
    },
  });
  res.status(201).json({ ok: true });
}));

export default router;
