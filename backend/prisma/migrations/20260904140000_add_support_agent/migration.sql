-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportAgent_email_key" ON "SupportAgent"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "SupportAgent_username_key" ON "SupportAgent"("username");
CREATE INDEX IF NOT EXISTS "SupportAgent_isDisabled_idx" ON "SupportAgent"("isDisabled");
