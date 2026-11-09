import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { updateAccount, changeUsername, updatePrivacy, deactivateAccount, deleteAccount, syncDiscordAvatar } from "../controllers/usersController.js";
import {
  getByUsername,
  listUserPosts,
  listUserReplies,
  listUserMentions,
  follow,
  unfollow,
  respondFollowRequest,
  listFollowRequests,
  listFollowers,
  listFollowing,
  listMutualFriends,
  listMutualsWith,
  blockUser,
  unblockUser,
  listBlocked,
  muteUser,
  unmuteUser,
  reportUser,
} from "../controllers/profileController.js";
import { writeLimiter, strictWriteLimiter } from "../middleware/rateLimit.js";

const router = Router();

const GUEST_RESERVED = new Set(["me", "follow-requests", "blocked", "mutual-friends"]);

function guestProfileGuard(req, res, next) {
  if (req.user) return requireActiveAccount(req, res, next);
  if (req.method === "GET") {
    const match = req.path.match(/^\/([^/]+)(?:\/(posts|replies))?$/);
    if (match && !GUEST_RESERVED.has(match[1])) return next();
  }
  return res.status(401).json({ message: "Not authenticated" });
}

router.use(optionalAuth, guestProfileGuard);

router.patch("/me/account", writeLimiter, asyncHandler(updateAccount));
router.patch("/me/username", writeLimiter, asyncHandler(changeUsername));
router.patch("/me/privacy", writeLimiter, asyncHandler(updatePrivacy));
router.post("/me/sync-avatar", strictWriteLimiter, asyncHandler(syncDiscordAvatar));
router.post("/me/deactivate", strictWriteLimiter, asyncHandler(deactivateAccount));
router.delete("/me", strictWriteLimiter, asyncHandler(deleteAccount));

router.get("/follow-requests", asyncHandler(listFollowRequests));
router.get("/blocked", asyncHandler(listBlocked));
router.get("/mutual-friends", asyncHandler(listMutualFriends));

router.get("/:username", asyncHandler(getByUsername));
router.get("/:username/posts", asyncHandler(listUserPosts));
router.get("/:username/replies", asyncHandler(listUserReplies));
router.get("/:username/mentions", asyncHandler(listUserMentions));
router.post("/:username/follow", writeLimiter, asyncHandler(follow));
router.post("/:username/unfollow", writeLimiter, asyncHandler(unfollow));
router.post("/:username/follow-request", writeLimiter, asyncHandler(respondFollowRequest));
router.get("/:username/mutuals", asyncHandler(listMutualsWith));
router.get("/:username/followers", asyncHandler(listFollowers));
router.get("/:username/following", asyncHandler(listFollowing));
router.post("/:username/block", writeLimiter, asyncHandler(blockUser));
router.post("/:username/unblock", writeLimiter, asyncHandler(unblockUser));
router.post("/:username/mute", writeLimiter, asyncHandler(muteUser));
router.post("/:username/unmute", writeLimiter, asyncHandler(unmuteUser));
router.post("/:username/report", strictWriteLimiter, asyncHandler(reportUser));

export default router;
