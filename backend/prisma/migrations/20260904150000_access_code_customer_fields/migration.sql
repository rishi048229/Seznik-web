-- AlterTable
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "printer" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessCode_createdBy_idx" ON "AccessCode"("createdBy");
