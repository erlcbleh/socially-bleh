CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "StaffAuditLog_communityId_createdAt_id_idx"
  ON "StaffAuditLog" ("communityId", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "StaffAuditLog_communityId_targetType_createdAt_idx"
  ON "StaffAuditLog" ("communityId", "targetType", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "StaffAuditLog_communityId_staffId_createdAt_idx"
  ON "StaffAuditLog" ("communityId", "staffId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "StaffAuditLog_action_idx"
  ON "StaffAuditLog" USING GIN ("action" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "StaffAuditLog_targetLabel_idx"
  ON "StaffAuditLog" USING GIN ("targetLabel" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "SecurityFlag_type_createdAt_idx"
  ON "SecurityFlag" ("type", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "SecurityFlag_createdAt_ip_idx"
  ON "SecurityFlag" ("createdAt" DESC, "ip");

CREATE INDEX IF NOT EXISTS "SecurityFlag_createdAt_userId_idx"
  ON "SecurityFlag" ("createdAt" DESC, "userId");

CREATE INDEX IF NOT EXISTS "SecurityFlag_createdAt_type_idx"
  ON "SecurityFlag" ("createdAt" DESC, "type");

CREATE INDEX IF NOT EXISTS "StaffSession_lastSeenAt_idx"
  ON "StaffSession" ("lastSeenAt" DESC);

CREATE INDEX IF NOT EXISTS "StaffSession_revokedAt_absoluteExpiresAt_lastSeenAt_idx"
  ON "StaffSession" ("revokedAt", "absoluteExpiresAt", "lastSeenAt" DESC);

CREATE INDEX IF NOT EXISTS "Report_status_createdAt_id_idx"
  ON "Report" ("status", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "Report_status_source_createdAt_id_idx"
  ON "Report" ("status", "source", "createdAt" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "Report_source_status_createdAt_idx"
  ON "Report" ("source", "status", "createdAt" DESC);
