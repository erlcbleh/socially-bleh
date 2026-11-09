import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { subscribeSchema, unsubscribeSchema } from "../schemas/pushSchemas.js";
import { getVapidKey, subscribe, unsubscribe } from "../controllers/pushController.js";

const router = Router();

router.get("/vapid-key", requireAuth, asyncHandler(getVapidKey));
router.post("/subscribe", requireAuth, writeLimiter, validateBody(subscribeSchema), asyncHandler(subscribe));
router.post("/unsubscribe", requireAuth, writeLimiter, validateBody(unsubscribeSchema), asyncHandler(unsubscribe));

export default router;
