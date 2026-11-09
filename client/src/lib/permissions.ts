import type { User } from "../types";

export const VIDEO_REQUIRES_VERIFICATION =
  "Only verified accounts can attach videos. Images and GIFs are available to everyone.";

export function canAttachVideo(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "staff" || user.role === "admin") return true;
  if (user.isVerified) return true;
  if (user.communityVerificationStatus === "approved") return true;
  if (user.professionalStatus === "approved") return true;
  return false;
}
