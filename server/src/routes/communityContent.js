import { Router } from "express";
import postRoutes from "./posts.js";
import communityUserRoutes from "./communityUsers.js";
import messageRoutes from "./messages.js";
import notificationRoutes from "./notifications.js";
import storyRoutes from "./stories.js";
import searchRoutes from "./search.js";
import trendingRoutes from "./trending.js";
import analyticsRoutes from "./analytics.js";

const router = Router({ mergeParams: true });

router.use("/posts", postRoutes);
router.use("/users", communityUserRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);
router.use("/stories", storyRoutes);
router.use("/search", searchRoutes);
router.use("/trending", trendingRoutes);
router.use("/analytics", analyticsRoutes);

export default router;
