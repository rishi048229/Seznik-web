-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "Feedback" ADD COLUMN "productId" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "Feedback" ADD COLUMN "productName" TEXT NOT NULL DEFAULT 'Unknown';

-- Backfill existing rows (defaults already applied)
UPDATE "Feedback" SET "platform" = 'unknown', "productId" = 'general', "productName" = 'Unknown' WHERE "platform" IS NULL OR "productId" IS NULL OR "productName" IS NULL;

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");
CREATE INDEX "Feedback_productId_idx" ON "Feedback"("productId");
