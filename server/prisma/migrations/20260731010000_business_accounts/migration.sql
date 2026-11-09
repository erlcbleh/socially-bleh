ALTER TABLE "User" ADD COLUMN "businessOwnerId" CHAR(24);

CREATE TABLE "BusinessApplication" (
    "id" CHAR(24) NOT NULL,
    "applicantId" CHAR(24) NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "bannerUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "staffNote" TEXT NOT NULL DEFAULT '',
    "reviewedById" CHAR(24),
    "reviewedAt" TIMESTAMP(3),
    "businessUserId" CHAR(24),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessCollaborator" (
    "id" CHAR(24) NOT NULL,
    "businessUserId" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'collaborator',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessCollaborator_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_businessOwnerId_idx" ON "User"("businessOwnerId");

CREATE INDEX "BusinessApplication_applicantId_createdAt_idx" ON "BusinessApplication"("applicantId", "createdAt" DESC);

CREATE INDEX "BusinessApplication_status_createdAt_idx" ON "BusinessApplication"("status", "createdAt" DESC);

CREATE INDEX "BusinessCollaborator_userId_idx" ON "BusinessCollaborator"("userId");

CREATE UNIQUE INDEX "BusinessCollaborator_businessUserId_userId_key" ON "BusinessCollaborator"("businessUserId", "userId");

ALTER TABLE "User" ADD CONSTRAINT "User_businessOwnerId_fkey" FOREIGN KEY ("businessOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessApplication" ADD CONSTRAINT "BusinessApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessApplication" ADD CONSTRAINT "BusinessApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessApplication" ADD CONSTRAINT "BusinessApplication_businessUserId_fkey" FOREIGN KEY ("businessUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BusinessCollaborator" ADD CONSTRAINT "BusinessCollaborator_businessUserId_fkey" FOREIGN KEY ("businessUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BusinessCollaborator" ADD CONSTRAINT "BusinessCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
