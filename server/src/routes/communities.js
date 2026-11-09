import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/requireAuth.js";
import { requireActiveAccount } from "../middleware/requireActiveAccount.js";
import { requireCommunity, guestCommunity, requireCommunityStaff, requireCommunityOwner, blockBannedMember, rejectGlobalCommunity } from "../middleware/requireCommunity.js";
import { GLOBAL_SLUG } from "../services/globalCommunity.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  writeLimiter,
  strictWriteLimiter,
  searchLimiter,
  authLimiter,
  inviteLookupLimiter,
} from "../middleware/rateLimit.js";
import {
  createCommunity,
  listMyCommunities,
  joinCommunity,
  getCommunity,
  updateCommunity,
  regenerateInviteCode,
  setInviteCode,
  leaveCommunity,
  listMembers,
  kickMember,
  banMember,
  unbanMember,
  promoteStaff,
  demoteStaff,
  applyProfessional,
  listProfessionalApplications,
  decideProfessionalApplication,
  applyCommunityVerification,
  respondCommunityVerificationInvite,
  listCommunityVerificationApplications,
  decideCommunityVerificationApplication,
  inviteCommunityVerification,
  listCommunityAuditLog,
  discoverCommunities,
  previewInvite,
  joinOpenCommunity,
  deleteCommunity,
  setCommunityDiscordWebhook,
  removeCommunityDiscordWebhook,
} from "../controllers/communitiesController.js";

const router = Router();

router.get("/invite/:code", inviteLookupLimiter, asyncHandler(previewInvite));

router.get(
  "/:slug",
  optionalAuth,
  asyncHandler(async (req, res, next) => {
    if (req.user) return next();
    if (String(req.params.slug || "").toLowerCase() !== GLOBAL_SLUG) return next();
    return guestCommunity(req, res, () => getCommunity(req, res, next));
  })
);

const authed = [requireAuth, requireActiveAccount];

router.post("/", ...authed, strictWriteLimiter, asyncHandler(createCommunity));
router.get("/mine", ...authed, asyncHandler(listMyCommunities));
router.get("/discover", ...authed, searchLimiter, asyncHandler(discoverCommunities));
router.post("/join", ...authed, authLimiter, asyncHandler(joinCommunity));
router.post("/:slug/join", ...authed, writeLimiter, asyncHandler(joinOpenCommunity));

router.get("/:slug", ...authed, requireCommunity, asyncHandler(getCommunity));
router.patch("/:slug", ...authed, requireCommunity, rejectGlobalCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(updateCommunity));
router.delete("/:slug", ...authed, requireCommunity, rejectGlobalCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(deleteCommunity));
router.post("/:slug/invite-code/regenerate", ...authed, requireCommunity, rejectGlobalCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(regenerateInviteCode));
router.post("/:slug/invite-code", ...authed, requireCommunity, rejectGlobalCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(setInviteCode));
router.put("/:slug/discord-webhook", ...authed, requireCommunity, rejectGlobalCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(setCommunityDiscordWebhook));
router.delete("/:slug/discord-webhook", ...authed, requireCommunity, rejectGlobalCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(removeCommunityDiscordWebhook));
router.post("/:slug/leave", ...authed, requireCommunity, blockBannedMember, asyncHandler(leaveCommunity));

router.get("/:slug/members", ...authed, requireCommunity, blockBannedMember, requireCommunityStaff, asyncHandler(listMembers));
router.post("/:slug/members/:username/kick", ...authed, requireCommunity, blockBannedMember, requireCommunityStaff, asyncHandler(kickMember));
router.post("/:slug/members/:username/ban", ...authed, requireCommunity, blockBannedMember, requireCommunityStaff, asyncHandler(banMember));
router.post("/:slug/members/:username/unban", ...authed, requireCommunity, blockBannedMember, requireCommunityStaff, asyncHandler(unbanMember));
router.post("/:slug/members/:username/promote", ...authed, requireCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(promoteStaff));
router.post("/:slug/members/:username/demote", ...authed, requireCommunity, blockBannedMember, requireCommunityOwner, asyncHandler(demoteStaff));

router.post("/:slug/professional/apply", ...authed, requireCommunity, blockBannedMember, asyncHandler(applyProfessional));
router.get("/:slug/professional/applications", ...authed, requireCommunity, blockBannedMember, requireCommunityStaff, asyncHandler(listProfessionalApplications));
router.post(
  "/:slug/professional/applications/:membershipId/decide",
  ...authed,
  requireCommunity,
  blockBannedMember,
  requireCommunityStaff,
  asyncHandler(decideProfessionalApplication)
);

router.post("/:slug/verification/apply", ...authed, requireCommunity, blockBannedMember, asyncHandler(applyCommunityVerification));
router.post("/:slug/verification/invite/respond", ...authed, requireCommunity, blockBannedMember, asyncHandler(respondCommunityVerificationInvite));
router.get(
  "/:slug/verification/applications",
  ...authed,
  requireCommunity,
  blockBannedMember,
  requireCommunityStaff,
  asyncHandler(listCommunityVerificationApplications)
);
router.post(
  "/:slug/verification/applications/:membershipId/decide",
  ...authed,
  requireCommunity,
  blockBannedMember,
  requireCommunityStaff,
  asyncHandler(decideCommunityVerificationApplication)
);
router.post(
  "/:slug/verification/members/:username/invite",
  ...authed,
  requireCommunity,
  blockBannedMember,
  requireCommunityStaff,
  asyncHandler(inviteCommunityVerification)
);

router.get("/:slug/audit-log", ...authed, requireCommunity, blockBannedMember, requireCommunityStaff, asyncHandler(listCommunityAuditLog));

export default router;
