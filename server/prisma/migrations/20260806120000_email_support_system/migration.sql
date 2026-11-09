CREATE TABLE "EmailConversation" (
    "id" CHAR(24) NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "mailbox" TEXT NOT NULL DEFAULT 'support',
    "customerEmail" TEXT NOT NULL,
    "claimedBy" CHAR(24),
    "claimedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Email" (
    "id" CHAR(24) NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "direction" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT[] NOT NULL,
    "cc" TEXT[] NOT NULL,
    "bcc" TEXT[] NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'delivered',
    "receivedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attachment" (
    "id" CHAR(24) NOT NULL,
    "emailId" CHAR(24) NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailDraft" (
    "id" CHAR(24) NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "authorId" CHAR(24) NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalNote" (
    "id" CHAR(24) NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "authorId" CHAR(24) NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailAuditLog" (
    "id" CHAR(24) NOT NULL,
    "conversationId" CHAR(24) NOT NULL,
    "staffId" CHAR(24),
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailConversation_status_idx" ON "EmailConversation"("status");

CREATE INDEX "EmailConversation_claimedBy_idx" ON "EmailConversation"("claimedBy");

CREATE INDEX "EmailConversation_updatedAt_idx" ON "EmailConversation"("updatedAt" DESC);

CREATE INDEX "EmailConversation_customerEmail_idx" ON "EmailConversation"("customerEmail");

CREATE INDEX "EmailConversation_mailbox_status_idx" ON "EmailConversation"("mailbox", "status");

CREATE INDEX "EmailConversation_mailbox_updatedAt_idx" ON "EmailConversation"("mailbox", "updatedAt" DESC);

CREATE UNIQUE INDEX "Email_messageId_key" ON "Email"("messageId");

CREATE INDEX "Email_conversationId_idx" ON "Email"("conversationId");

CREATE INDEX "Email_direction_idx" ON "Email"("direction");

CREATE INDEX "Email_createdAt_idx" ON "Email"("createdAt" DESC);

CREATE INDEX "Attachment_emailId_idx" ON "Attachment"("emailId");

CREATE UNIQUE INDEX "EmailDraft_conversationId_authorId_key" ON "EmailDraft"("conversationId", "authorId");

CREATE INDEX "EmailDraft_conversationId_idx" ON "EmailDraft"("conversationId");

CREATE INDEX "InternalNote_conversationId_idx" ON "InternalNote"("conversationId");

CREATE INDEX "InternalNote_createdAt_idx" ON "InternalNote"("createdAt" DESC);

CREATE INDEX "EmailAuditLog_conversationId_idx" ON "EmailAuditLog"("conversationId");

CREATE INDEX "EmailAuditLog_createdAt_idx" ON "EmailAuditLog"("createdAt" DESC);

ALTER TABLE "EmailConversation" ADD CONSTRAINT "EmailConversation_claimedBy_fkey" FOREIGN KEY ("claimedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Email" ADD CONSTRAINT "Email_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "EmailConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "EmailConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDraft" ADD CONSTRAINT "EmailDraft_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "EmailConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAuditLog" ADD CONSTRAINT "EmailAuditLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "EmailConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailAuditLog" ADD CONSTRAINT "EmailAuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
