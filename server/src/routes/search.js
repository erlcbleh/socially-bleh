import { searchLimiter } from "../middleware/rateLimit.js";
import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { search } from "../controllers/searchController.js";

const router = Router();

router.get("/", searchLimiter, asyncHandler(search));

export default router;
