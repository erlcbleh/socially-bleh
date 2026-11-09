import { isStaffRole } from "./moderationVisibility.js";

export function canAttachVideo(user, membership) {
  if (!user) return false;
  if (isStaffRole(user.role)) return true;
  if (user.isVerified) return true;
  if (membership?.verificationStatus === "approved") return true;
  if (membership?.professionalStatus === "approved") return true;
  return false;
}

export const VIDEO_REQUIRES_VERIFICATION =
  "Only verified accounts can attach videos. Images and GIFs are available to everyone.";
