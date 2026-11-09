import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { optionalAuth, requireAuth } from "../middleware/requireAuth.js";
import { authLimiter, staffAuthLimiter } from "../middleware/rateLimit.js";
import { discordRedirect, discordCallback, verifyNetwork, me, logout, listAccounts, switchAccount, switchToPersonal } from "../controllers/authController.js";
import { staffDiscordRedirect, staffDiscordCallback } from "../controllers/staffAuthController.js";

const router = Router();

router.get("/verify-network", authLimiter, asyncHandler(verifyNetwork));
router.get("/discord", authLimiter, discordRedirect);
router.get("/discord/callback", authLimiter, optionalAuth, asyncHandler(discordCallback));

router.get("/staff/discord", staffAuthLimiter, staffDiscordRedirect);
router.get("/staff/discord/callback", staffAuthLimiter, asyncHandler(staffDiscordCallback));

router.get("/me", optionalAuth, asyncHandler(me));
router.post("/logout", logout);

router.get("/accounts", requireAuth, asyncHandler(listAccounts));
router.post("/accounts/:userId/switch", requireAuth, asyncHandler(switchAccount));
router.post("/switch-to-personal", requireAuth, asyncHandler(switchToPersonal));

export default router;
