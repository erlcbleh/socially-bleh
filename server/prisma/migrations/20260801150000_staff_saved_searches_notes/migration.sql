CREATE TABLE "StaffSavedSearch" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffSavedSearch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StaffNote" (
    "id" CHAR(24) NOT NULL,
    "authorId" CHAR(24) NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" CHAR(24),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StaffSavedSearch_userId_updatedAt_idx" ON "StaffSavedSearch"("userId", "updatedAt" DESC);
CREATE INDEX "StaffSavedSearch_isShared_updatedAt_idx" ON "StaffSavedSearch"("isShared", "updatedAt" DESC);
CREATE INDEX "StaffSavedSearch_userId_panelId_idx" ON "StaffSavedSearch"("userId", "panelId");
CREATE UNIQUE INDEX "StaffSavedSearch_userId_name_key" ON "StaffSavedSearch"("userId", "name");
CREATE INDEX "StaffNote_createdAt_idx" ON "StaffNote"("createdAt" DESC);
CREATE INDEX "StaffNote_authorId_createdAt_idx" ON "StaffNote"("authorId", "createdAt" DESC);
CREATE INDEX "StaffNote_targetType_targetId_createdAt_idx" ON "StaffNote"("targetType", "targetId", "createdAt" DESC);
CREATE INDEX "StaffNote_pinned_createdAt_idx" ON "StaffNote"("pinned", "createdAt" DESC);
ALTER TABLE "StaffSavedSearch" ADD CONSTRAINT "StaffSavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffNote" ADD CONSTRAINT "StaffNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
