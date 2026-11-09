import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { validateBody } from "../middleware/validate.js";
import { writeLimiter, strictWriteLimiter, postLimiter, replyLimiter, hourlyPostLimiter } from "../middleware/rateLimit.js";
import { createPostSchema } from "../schemas/postSchemas.js";
import {
  createPost,
  getFeed,
  getPost,
  getComments,
  editPost,
  deletePost,
  pinPost,
  unpinPost,
  votePoll,
  removePollVote,
  getPollVoters,
  likePost,
  unlikePost,
  repost,
  unrepost,
  markNotInterested,
  bookmarkPost,
  unbookmarkPost,
  listBookmarks,
  reportPost,
} from "../controllers/postsController.js";

const router = Router();

router.get("/", asyncHandler(getFeed));
router.post("/", postLimiter, replyLimiter, hourlyPostLimiter, writeLimiter, validateBody(createPostSchema), asyncHandler(createPost));
router.get("/bookmarks", asyncHandler(listBookmarks));
router.get("/:id", asyncHandler(getPost));
router.patch("/:id", writeLimiter, asyncHandler(editPost));
router.delete("/:id", writeLimiter, asyncHandler(deletePost));
router.get("/:id/comments", asyncHandler(getComments));
router.post("/:id/vote", writeLimiter, asyncHandler(votePoll));
router.delete("/:id/vote", writeLimiter, asyncHandler(removePollVote));
router.get("/:id/poll/voters", asyncHandler(getPollVoters));
router.post("/:id/like", writeLimiter, asyncHandler(likePost));
router.post("/:id/unlike", writeLimiter, asyncHandler(unlikePost));
router.post("/:id/repost", writeLimiter, asyncHandler(repost));
router.post("/:id/unrepost", writeLimiter, asyncHandler(unrepost));
router.post("/:id/not-interested", writeLimiter, asyncHandler(markNotInterested));
router.post("/:id/bookmark", writeLimiter, asyncHandler(bookmarkPost));
router.post("/:id/unbookmark", writeLimiter, asyncHandler(unbookmarkPost));
router.post("/:id/report", strictWriteLimiter, asyncHandler(reportPost));
router.post("/:id/pin", writeLimiter, asyncHandler(pinPost));
router.post("/:id/unpin", writeLimiter, asyncHandler(unpinPost));

export default router;
