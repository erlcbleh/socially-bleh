import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireStaffSession } from "../middleware/requireStaffSession.js";
import { staffApiLimiter } from "../middleware/rateLimit.js";
import { staffMe, staffLogout, listOwnStaffSessions, refreshStaffContext } from "../controllers/staffAuthController.js";

const router = Router();

router.use(requireStaffSession, staffApiLimiter);

router.get("/me", asyncHandler(staffMe));
router.post("/logout", asyncHandler(staffLogout));
router.get("/sessions", asyncHandler(listOwnStaffSessions));
router.get("/context", asyncHandler(refreshStaffContext));

export default router;
