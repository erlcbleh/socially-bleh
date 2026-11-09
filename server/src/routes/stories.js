import { writeLimiter } from "../middleware/rateLimit.js";
import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { createStory, getStoryFeed, getUserStories, viewStory, deleteStory } from "../controllers/storiesController.js";

const router = Router();

router.get("/feed", asyncHandler(getStoryFeed));
router.post("/", writeLimiter, asyncHandler(createStory));
router.get("/user/:username", asyncHandler(getUserStories));
router.post("/:id/view", writeLimiter, asyncHandler(viewStory));
router.delete("/:id", writeLimiter, asyncHandler(deleteStory));

export default router;
