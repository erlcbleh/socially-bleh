ALTER TABLE "StaffAuditLog" ADD COLUMN "important" BOOLEAN NOT NULL DEFAULT false;

UPDATE "StaffAuditLog" SET "important" = true WHERE "action" IN (
  'ban_user',
  'suspend_user',
  'deactivate_user',
  'reinstate_user',
  'delete_post',
  'delete_account',
  'ban_and_delete_account',
  'purge_recent_content',
  'auto_block_ban_evasion',
  'auto_unblock_ban_evasion',
  'promote_staff_role',
  'demote_staff_role',
  'ban_ip',
  'unban_ip',
  'revoke_staff_session',
  'accept_staff_application',
  'reject_staff_application',
  'resolve_copyright_request',
  'dismiss_copyright_request',
  'delete_business_account',
  'approve_business_application',
  'reject_business_application',
  'delete_hashtag',
  'export_audit_log'
);

CREATE INDEX "StaffAuditLog_important_createdAt_idx" ON "StaffAuditLog"("important", "createdAt");
