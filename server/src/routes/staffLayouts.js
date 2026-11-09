import { Router } from "express";
import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireStaffSession, requireStaffAdmin } from "../middleware/requireStaffSession.js";
import { staffApiLimiter } from "../middleware/rateLimit.js";
import {
  listLayouts,
  saveLayout,
  renameLayout,
  setDefaultLayout,
  deleteLayout,
  shareLayoutAsPreset,
  deletePreset,
  createShareCode,
  revokeShareCode,
  previewSharedLayout,
  importSharedLayout,
} from "../controllers/staffLayoutController.js";

const router = Router();

router.use(requireStaffSession, staffApiLimiter, express.json({ limit: "1mb" }));

router.get("/", asyncHandler(listLayouts));
router.put("/", asyncHandler(saveLayout));

router.post("/import", asyncHandler(importSharedLayout));
router.get("/shared/:code", asyncHandler(previewSharedLayout));
router.post("/:id/share", asyncHandler(createShareCode));
router.delete("/:id/share", asyncHandler(revokeShareCode));

router.patch("/:id", asyncHandler(renameLayout));
router.post("/:id/default", asyncHandler(setDefaultLayout));
router.delete("/:id", asyncHandler(deleteLayout));

router.post("/presets", requireStaffAdmin, asyncHandler(shareLayoutAsPreset));
router.delete("/presets/:id", requireStaffAdmin, asyncHandler(deletePreset));

export default router;
