import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireStaffSession, requireStaffAdmin } from "../middleware/requireStaffSession.js";
import { staffApiLimiter, staffWriteLimiter, emailWebhookLimiter } from "../middleware/rateLimit.js";
import {
  listConversations,
  getConversation,
  claimConversation,
  unclaimConversation,
  updateConversationStatus,
  addInternalNote,
  saveDraft,
  deleteDraft,
  sendReply,
  composeEmail,
  downloadAttachment,
  handleResendWebhook,
} from "../controllers/emailSupportController.js";

const router = express.Router();

router.post("/webhook/resend", emailWebhookLimiter, asyncHandler(handleResendWebhook));

router.use(requireStaffSession, requireStaffAdmin, staffApiLimiter, staffWriteLimiter);

router.post("/compose", asyncHandler(composeEmail));
router.get("/conversations", asyncHandler(listConversations));
router.get("/conversations/:id", asyncHandler(getConversation));
router.post("/conversations/:id/claim", asyncHandler(claimConversation));
router.post("/conversations/:id/unclaim", asyncHandler(unclaimConversation));
router.post("/conversations/:id/status", asyncHandler(updateConversationStatus));
router.post("/conversations/:id/notes", asyncHandler(addInternalNote));
router.post("/conversations/:id/draft", asyncHandler(saveDraft));
router.delete("/conversations/:id/draft", asyncHandler(deleteDraft));
router.post("/conversations/:id/reply", asyncHandler(sendReply));
router.get("/conversations/:id/attachments/:attachmentId", asyncHandler(downloadAttachment));

export default router;
