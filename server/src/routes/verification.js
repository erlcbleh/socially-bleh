import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { apply, status } from "../controllers/verificationController.js";

const router = Router();
router.use(requireAuth, requireActiveAccount);

router.post("/apply", asyncHandler(apply));
router.get("/status", asyncHandler(status));

export default router;
