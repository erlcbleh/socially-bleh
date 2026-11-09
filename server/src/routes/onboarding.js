import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { checkUsername, setUsername, setInterests, listInterestTags, completeOnboarding, markPromoVideoSeen } from "../controllers/onboardingController.js";

const router = Router();
router.use(requireAuth, requireActiveAccount);

router.get("/check-username", asyncHandler(checkUsername));
router.patch("/username", asyncHandler(setUsername));
router.get("/interest-tags", listInterestTags);
router.patch("/interests", asyncHandler(setInterests));
router.post("/complete", asyncHandler(completeOnboarding));
router.post("/promo-video-seen", asyncHandler(markPromoVideoSeen));

export default router;
