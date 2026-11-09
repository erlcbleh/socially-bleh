import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { listNotifications, unreadCount, markAllRead } from "../controllers/notificationsController.js";

const router = Router();

router.get("/", asyncHandler(listNotifications));
router.get("/unread-count", asyncHandler(unreadCount));
router.post("/read-all", writeLimiter, asyncHandler(markAllRead));

export default router;
