ALTER TABLE "BannedIp" RENAME COLUMN "ip" TO "ipHash";
ALTER TABLE "SecurityFlag" RENAME COLUMN "ip" TO "ipHash";
ALTER TABLE "StaffSession" RENAME COLUMN "ip" TO "ipHash";

ALTER INDEX "BannedIp_ip_key" RENAME TO "BannedIp_ipHash_key";
ALTER INDEX "SecurityFlag_ip_createdAt_idx" RENAME TO "SecurityFlag_ipHash_createdAt_idx";
ALTER INDEX "SecurityFlag_createdAt_ip_idx" RENAME TO "SecurityFlag_createdAt_ipHash_idx";

UPDATE "SecurityFlag" SET "ipHash" = NULL WHERE "ipHash" !~ '^[0-9a-f]{64}$';
UPDATE "StaffSession" SET "ipHash" = '' WHERE "ipHash" !~ '^[0-9a-f]{64}$';

UPDATE "StaffAuditLog" SET "targetLabel" = 'redacted' WHERE "targetType" = 'ip';

UPDATE "StaffAuditLog"
SET "meta" = "meta" - 'ip'
WHERE "meta" IS NOT NULL AND jsonb_typeof("meta") = 'object';
