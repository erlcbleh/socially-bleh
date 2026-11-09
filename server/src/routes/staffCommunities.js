import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  requireStaffSession,
  requireStaffCommunity,
  requireStaffPermission,
} from "../middleware/requireStaffSession.js";
import { staffApiLimiter, staffWriteLimiter } from "../middleware/rateLimit.js";
import {
  listStaffCommunities,
  getCommunityUserDetails,
  listCommunityReports,
  actionCommunityReport,
  listCommunityStaffAuditLog,
  transferCommunityOwnership,
} from "../controllers/staffCommunityController.js";
import {
  listMembers,
  kickMember,
  banMember,
  unbanMember,
  promoteStaff,
  demoteStaff,
  listProfessionalApplications,
  decideProfessionalApplication,
  listCommunityVerificationApplications,
  decideCommunityVerificationApplication,
} from "../controllers/communitiesController.js";

const router = Router();

router.use(requireStaffSession, staffApiLimiter, staffWriteLimiter);

function actAsCommunityStaff(req, res, next) {
  req.user = req.staffUser;
  req.membership = { role: req.communityRole };
  next();
}

const asCommunityStaff = (minRole = "staff") => [
  requireStaffCommunity(minRole),
  actAsCommunityStaff,
];

router.get("/", asyncHandler(listStaffCommunities));

router.post(
  "/:id/transfer",
  requireStaffPermission("manage_applications"),
  (req, res, next) => {
    req.user = req.staffUser;
    next();
  },
  asyncHandler(transferCommunityOwnership)
);

router.get("/:slug/reports", asCommunityStaff(), asyncHandler(listCommunityReports));
router.post("/:slug/reports/:id/action", asCommunityStaff(), asyncHandler(actionCommunityReport));

router.get("/:slug/users/:username/details", asCommunityStaff(), asyncHandler(getCommunityUserDetails));

router.get("/:slug/members", asCommunityStaff(), asyncHandler(listMembers));
router.post("/:slug/members/:username/kick", asCommunityStaff(), asyncHandler(kickMember));
router.post("/:slug/members/:username/ban", asCommunityStaff(), asyncHandler(banMember));
router.post("/:slug/members/:username/unban", asCommunityStaff(), asyncHandler(unbanMember));
router.post("/:slug/members/:username/promote", asCommunityStaff("owner"), asyncHandler(promoteStaff));
router.post("/:slug/members/:username/demote", asCommunityStaff("owner"), asyncHandler(demoteStaff));

router.get("/:slug/professional", asCommunityStaff(), asyncHandler(listProfessionalApplications));
router.post(
  "/:slug/professional/:membershipId/decide",
  asCommunityStaff(),
  asyncHandler(decideProfessionalApplication)
);

router.get("/:slug/verification", asCommunityStaff(), asyncHandler(listCommunityVerificationApplications));
router.post(
  "/:slug/verification/:membershipId/decide",
  asCommunityStaff(),
  asyncHandler(decideCommunityVerificationApplication)
);

router.get("/:slug/audit-log", asCommunityStaff(), asyncHandler(listCommunityStaffAuditLog));

export default router;
