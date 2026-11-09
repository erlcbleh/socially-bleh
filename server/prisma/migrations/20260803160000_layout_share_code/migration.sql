ALTER TABLE "StaffLayout" ADD COLUMN IF NOT EXISTS "shareCode" VARCHAR(16);

CREATE UNIQUE INDEX IF NOT EXISTS "StaffLayout_shareCode_key" ON "StaffLayout"("shareCode");
