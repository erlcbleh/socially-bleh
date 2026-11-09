ALTER TABLE "StaffAuditLog" ALTER COLUMN "targetId" DROP NOT NULL;

UPDATE "StaffAuditLog" SET "targetId" = NULL WHERE TRIM("targetId") IN ('undefined', 'null', '');
