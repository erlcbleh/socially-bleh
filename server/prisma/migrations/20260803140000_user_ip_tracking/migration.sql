CREATE TABLE IF NOT EXISTS "UserIpAddress" (
    "id" CHAR(24) NOT NULL,
    "userId" CHAR(24) NOT NULL,
    "ipHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIpAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserIpAddress_userId_ipHash_key" ON "UserIpAddress"("userId", "ipHash");

CREATE INDEX IF NOT EXISTS "UserIpAddress_ipHash_lastSeenAt_idx" ON "UserIpAddress"("ipHash", "lastSeenAt" DESC);

CREATE INDEX IF NOT EXISTS "UserIpAddress_userId_lastSeenAt_idx" ON "UserIpAddress"("userId", "lastSeenAt" DESC);

ALTER TABLE "UserIpAddress" ADD CONSTRAINT "UserIpAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
