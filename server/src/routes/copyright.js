import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { publicFormLimiter } from "../middleware/rateLimit.js";
import { submitRequest } from "../controllers/copyrightController.js";

const router = Router();

router.post("/requests", publicFormLimiter, asyncHandler(submitRequest));

export default router;
