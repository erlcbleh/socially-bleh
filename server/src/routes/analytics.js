import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { analyticsLimiter } from "../middleware/rateLimit.js";
import { logImpressions, logProfileView, logClick, summary } from "../controllers/analyticsController.js";

const router = Router();

router.post("/impressions", analyticsLimiter, asyncHandler(logImpressions));
router.post("/profile-view/:username", analyticsLimiter, asyncHandler(logProfileView));
router.post("/click", analyticsLimiter, asyncHandler(logClick));
router.get("/summary", asyncHandler(summary));

export default router;
