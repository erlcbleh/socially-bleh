CREATE TABLE "StaffLayout" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24),
    "name" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "layout" JSONB NOT NULL,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffLayout_userId_name_key" ON "StaffLayout"("userId", "name");
CREATE INDEX "StaffLayout_isPreset_updatedAt_idx" ON "StaffLayout"("isPreset", "updatedAt" DESC);
CREATE INDEX "StaffLayout_userId_isDefault_idx" ON "StaffLayout"("userId", "isDefault");

ALTER TABLE "StaffLayout" ADD CONSTRAINT "StaffLayout_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffLayout" ADD CONSTRAINT "StaffLayout_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
