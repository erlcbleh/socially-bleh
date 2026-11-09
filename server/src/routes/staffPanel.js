import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  requireStaffSession,
  requireGlobalStaff,
  requireStaffPermission,
} from "../middleware/requireStaffSession.js";
import { staffApiLimiter, staffWriteLimiter } from "../middleware/rateLimit.js";
import { listPanelReports, getPanelReport, getQueueCounts } from "../controllers/staffPanelController.js";
import {
  listPanelAuditLog,
  exportAuditLogCsv,
  listSecurityFlags,
  listSecurityFlagDetail,
  listPanelStaffSessions,
  revokePanelStaffSession,
  getStaffActivity,
  listModerationHistory,
  listUserAuditLog,
  undoAuditAction,
} from "../controllers/staffPanelAdminController.js";
import {
  actionReport,
  updateReportNote,
  bulkActionReports,
  listVerificationApplications,
  decideVerification,
  lookupUsers,
  getUserDetails,
  listUserPosts,
  listUserReports,
  moderateUser,
  listCopyrightRequests,
  decideCopyrightRequest,
  listStaffApplications,
  decideStaffApplication,
  revertStaffApplication,
  revertVerification,
  revertCopyrightRequest,
  updateUserBadges,
  resetUsername,
  setUserLabel,
  listStaffMembers,
  updateStaffRole,
  listBannedIps,
  banIp,
  unbanIp,
} from "../controllers/staffController.js";

import {
  getAiCategoryBreakdown,
  listAiFalsePositives,
  listAiStuckPosts,
} from "../controllers/staffAiController.js";

import {
  listBusinessApplications,
  decideBusinessApplication,
  revertBusinessApplication,
} from "../controllers/businessController.js";
import {
  listBusinessAccounts,
  listDeletedBusinesses,
  setBusinessLabel,
  deleteBusinessAccount,
} from "../controllers/staffBusinessController.js";
import { getHashtagDetails, deleteHashtag } from "../controllers/staffController.js";
import {
  listSavedSearches,
  saveSearch,
  deleteSavedSearch,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
} from "../controllers/staffWorkspaceController.js";

const router = Router();

function actAsStaffUser(req, res, next) {
  req.user = req.staffUser;
  next();
}

router.use(requireStaffSession, staffApiLimiter, staffWriteLimiter, actAsStaffUser);

router.get("/reports", requireGlobalStaff, asyncHandler(listPanelReports));
router.post("/reports/bulk-action", requireGlobalStaff, asyncHandler(bulkActionReports));
router.get("/reports/:id", requireGlobalStaff, asyncHandler(getPanelReport));
router.post("/reports/:id/action", requireGlobalStaff, asyncHandler(actionReport));
router.patch("/reports/:id/note", requireGlobalStaff, asyncHandler(updateReportNote));
router.get("/queue-counts", requireGlobalStaff, asyncHandler(getQueueCounts));

router.get("/verification", requireGlobalStaff, asyncHandler(listVerificationApplications));
router.post("/verification/:id/decide", requireGlobalStaff, asyncHandler(decideVerification));
router.post("/verification/:id/revert", requireGlobalStaff, asyncHandler(revertVerification));

router.get("/users", requireGlobalStaff, asyncHandler(lookupUsers));
router.get("/users/:username/details", requireGlobalStaff, asyncHandler(getUserDetails));
router.get("/users/:username/posts", requireGlobalStaff, asyncHandler(listUserPosts));
router.get("/users/:username/reports", requireGlobalStaff, asyncHandler(listUserReports));
router.post("/users/:username/moderate", requireGlobalStaff, asyncHandler(moderateUser));
router.post("/users/:username/badges", requireGlobalStaff, asyncHandler(updateUserBadges));
router.post("/users/:username/reset-username", requireGlobalStaff, asyncHandler(resetUsername));
router.put("/users/:username/label", requireGlobalStaff, asyncHandler(setUserLabel));
router.get("/users/:username/audit-log", requireStaffPermission("view_audit_log"), asyncHandler(listUserAuditLog));

router.get("/banned-ips", requireStaffPermission("view_private_data"), asyncHandler(listBannedIps));
router.post("/banned-ips", requireStaffPermission("view_private_data"), asyncHandler(banIp));
router.delete("/banned-ips/:ipHash",requireStaffPermission("view_private_data"), asyncHandler(unbanIp));

router.get("/audit-log", requireStaffPermission("view_audit_log"), asyncHandler(listPanelAuditLog));
router.get("/audit-log.csv", requireStaffPermission("view_audit_log"), asyncHandler(exportAuditLogCsv));
router.post("/audit-log/:id/undo", requireStaffPermission("view_audit_log"), asyncHandler(undoAuditAction));

router.get("/business-applications", requireStaffPermission("manage_applications"), asyncHandler(listBusinessApplications));
router.post("/business-applications/:id/action", requireStaffPermission("manage_applications"), asyncHandler(decideBusinessApplication));
router.post("/business-applications/:id/revert", requireStaffPermission("manage_applications"), asyncHandler(revertBusinessApplication));

router.get("/businesses", requireStaffPermission("manage_applications"), asyncHandler(listBusinessAccounts));
router.get("/businesses/deleted", requireStaffPermission("manage_applications"), asyncHandler(listDeletedBusinesses));
router.put("/businesses/:id/label", requireStaffPermission("manage_applications"), asyncHandler(setBusinessLabel));
router.delete("/businesses/:id", requireStaffPermission("manage_applications"), asyncHandler(deleteBusinessAccount));

router.get("/hashtags/details", requireGlobalStaff, asyncHandler(getHashtagDetails));
router.post("/hashtags/delete", requireGlobalStaff, asyncHandler(deleteHashtag));

router.get("/saved-searches", requireGlobalStaff, asyncHandler(listSavedSearches));
router.put("/saved-searches", requireGlobalStaff, asyncHandler(saveSearch));
router.delete("/saved-searches/:id", requireGlobalStaff, asyncHandler(deleteSavedSearch));

router.get("/notes", requireGlobalStaff, asyncHandler(listNotes));
router.post("/notes", requireGlobalStaff, asyncHandler(createNote));
router.patch("/notes/:id", requireGlobalStaff, asyncHandler(updateNote));
router.delete("/notes/:id", requireGlobalStaff, asyncHandler(deleteNote));

router.get("/ai/categories", requireGlobalStaff, asyncHandler(getAiCategoryBreakdown));
router.get("/ai/false-positives", requireGlobalStaff, asyncHandler(listAiFalsePositives));
router.get("/ai/stuck", requireGlobalStaff, asyncHandler(listAiStuckPosts));

router.get("/moderation-history", requireGlobalStaff, asyncHandler(listModerationHistory));

router.get("/staff-activity", requireStaffPermission("view_audit_log"), asyncHandler(getStaffActivity));

router.get("/security-flags", requireStaffPermission("view_private_data"), asyncHandler(listSecurityFlags));
router.get(
  "/security-flags/detail",
  requireStaffPermission("view_private_data"),
  asyncHandler(listSecurityFlagDetail)
);

router.get("/staff-sessions", requireStaffPermission("view_private_data"), asyncHandler(listPanelStaffSessions));
router.post(
  "/staff-sessions/:jti/revoke",
  requireStaffPermission("view_private_data"),
  asyncHandler(revokePanelStaffSession)
);

router.get("/copyright-requests", requireStaffPermission("manage_copyright"), asyncHandler(listCopyrightRequests));
router.post("/copyright-requests/:id/action", requireStaffPermission("manage_copyright"), asyncHandler(decideCopyrightRequest));
router.post("/copyright-requests/:id/revert", requireStaffPermission("manage_copyright"), asyncHandler(revertCopyrightRequest));

router.get("/staff-applications", requireStaffPermission("manage_applications"), asyncHandler(listStaffApplications));
router.post("/staff-applications/:id/action", requireStaffPermission("manage_applications"), asyncHandler(decideStaffApplication));
router.post("/staff-applications/:id/revert", requireStaffPermission("manage_applications"), asyncHandler(revertStaffApplication));

router.get("/staff-members", requireStaffPermission("manage_roles"), asyncHandler(listStaffMembers));
router.post("/users/:username/role", requireStaffPermission("manage_roles"), asyncHandler(updateStaffRole));

export default router;
