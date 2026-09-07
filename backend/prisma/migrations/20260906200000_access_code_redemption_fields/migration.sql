-- AlterTable
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "isUsed" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "usedByUserId" TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessCode_isUsed_idx" ON "AccessCode"("isUsed");
CREATE INDEX IF NOT EXISTS "AccessCode_usedByUserId_idx" ON "AccessCode"("usedByUserId");
CREATE INDEX IF NOT EXISTS "AccessCode_invoiceNumber_idx" ON "AccessCode"("invoiceNumber");
