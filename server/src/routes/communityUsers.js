import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { searchLimiter } from "../middleware/rateLimit.js";
import { searchUsers } from "../controllers/communityUsersController.js";

const router = Router();

router.get("/search", searchLimiter, asyncHandler(searchUsers));

export default router;
