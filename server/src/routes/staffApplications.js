import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { publicFormLimiter, authLimiter, publicReadLimiter } from "../middleware/rateLimit.js";
import { submitApplication, applicationDiscordRedirect, getApplicationDiscordIdentity } from "../controllers/staffApplicationController.js";

const router = Router();

router.get("/discord/redirect", authLimiter, applicationDiscordRedirect);
router.get("/discord/me", publicReadLimiter, getApplicationDiscordIdentity);
router.post("/", publicFormLimiter, asyncHandler(submitApplication));

export default router;
