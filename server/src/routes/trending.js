import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { trendingHashtags } from "../controllers/trendingController.js";

const router = Router();

router.get("/hashtags", asyncHandler(trendingHashtags));

export default router;
