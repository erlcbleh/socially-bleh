import { writeLimiter, strictWriteLimiter, typingLimiter } from "../middleware/rateLimit.js";
import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  listConversations,
  getConversation,
  getMessages,
  sendMessage,
  reportMessage,
  unreadCount,
  createGroup,
  getGroup,
  getGroupMessages,
  sendGroupMessage,
  addGroupMember,
  removeGroupMember,
  updateGroup,
  editMessage,
  deleteMessage,
  reactToMessage,
  setTyping,
  getTyping,
  setGroupTyping,
  getGroupTyping,
} from "../controllers/messagesController.js";

const router = Router();

router.get("/conversations", asyncHandler(listConversations));
router.get("/conversations/:username", asyncHandler(getConversation));
router.get("/conversations/:username/messages", asyncHandler(getMessages));
router.post("/conversations/:username/messages", writeLimiter, asyncHandler(sendMessage));
router.get("/conversations/:username/typing", asyncHandler(getTyping));
router.post("/conversations/:username/typing", typingLimiter, asyncHandler(setTyping));
router.patch("/:id", writeLimiter, asyncHandler(editMessage));
router.delete("/:id", writeLimiter, asyncHandler(deleteMessage));
router.post("/:id/react", writeLimiter, asyncHandler(reactToMessage));
router.post("/:id/report", strictWriteLimiter, asyncHandler(reportMessage));
router.get("/unread-count", asyncHandler(unreadCount));

router.post("/groups", strictWriteLimiter, asyncHandler(createGroup));
router.get("/groups/:id", asyncHandler(getGroup));
router.patch("/groups/:id", writeLimiter, asyncHandler(updateGroup));
router.get("/groups/:id/messages", asyncHandler(getGroupMessages));
router.post("/groups/:id/messages", writeLimiter, asyncHandler(sendGroupMessage));
router.get("/groups/:id/typing", asyncHandler(getGroupTyping));
router.post("/groups/:id/typing", typingLimiter, asyncHandler(setGroupTyping));
router.post("/groups/:id/members", writeLimiter, asyncHandler(addGroupMember));
router.post("/groups/:id/members/:username/remove", writeLimiter, asyncHandler(removeGroupMember));

export default router;
