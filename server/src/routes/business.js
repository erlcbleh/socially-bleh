import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { writeLimiter } from "../middleware/rateLimit.js";
import {
  applyBusiness,
  checkBusinessInvite,
  getBusinessStatus,
  deleteBusiness,
  cancelApplication,
  listCollaborators,
  addCollaborator,
  removeCollaborator,
  searchCollaboratorCandidates,
} from "../controllers/businessController.js";

const router = Router();
router.use(requireAuth, requireActiveAccount);

router.post("/check-invite", writeLimiter, asyncHandler(checkBusinessInvite));
router.post("/apply", writeLimiter, asyncHandler(applyBusiness));
router.get("/status", asyncHandler(getBusinessStatus));
router.delete("/application/:applicationId", writeLimiter, asyncHandler(cancelApplication));
router.delete("/:businessId", writeLimiter, asyncHandler(deleteBusiness));

router.get("/collaborators/search", asyncHandler(searchCollaboratorCandidates));
router.get("/collaborators", asyncHandler(listCollaborators));
router.post("/collaborators", writeLimiter, asyncHandler(addCollaborator));
router.delete("/collaborators/:userId", writeLimiter, asyncHandler(removeCollaborator));

export default router;
