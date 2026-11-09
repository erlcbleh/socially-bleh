import { prisma } from "../db/prisma.js";
import { newId } from "../lib/ids.js";
import { auditAppended } from "./staffEvents.js";

const IMPORTANT_ACTIONS = new Set([
  "ban_user",
  "suspend_user",
  "deactivate_user",
  "reinstate_user",
  "delete_post",
  "delete_account",
  "ban_and_delete_account",
  "purge_recent_content",
  "auto_block_ban_evasion",
  "auto_unblock_ban_evasion",
  "promote_staff_role",
  "demote_staff_role",
  "ban_ip",
  "unban_ip",
  "revoke_staff_session",
  "accept_staff_application",
  "reject_staff_application",
  "resolve_copyright_request",
  "dismiss_copyright_request",
  "delete_business_account",
  "approve_business_application",
  "reject_business_application",
  "delete_hashtag",
  "export_audit_log",
]);

export function isImportantAction(action) {
  return IMPORTANT_ACTIONS.has(action);
}

export async function logStaffAction({
  staffId,
  action,
  targetType,
  targetId,
  targetUser,
  targetLabel,
  community,
  meta,
  snapshot,
  important,
}) {
  const resolvedMeta = snapshot ? { ...(meta ?? {}), snapshot } : meta;

  const entry = await prisma.staffAuditLog.create({
    data: {
      id: newId(),
      staffId: String(staffId),
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      targetUserId: targetUser ? String(targetUser) : null,
      targetLabel: targetLabel || "",
      communityId: community ? String(community) : null,
      meta: resolvedMeta ?? undefined,
      important: important ?? IMPORTANT_ACTIONS.has(action),
    },
  });

  auditAppended(entry);
}
