-- CreateTable
CREATE TABLE "QrLoginSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrLoginSession_tokenHash_key" ON "QrLoginSession"("tokenHash");

-- CreateIndex
CREATE INDEX "QrLoginSession_userId_idx" ON "QrLoginSession"("userId");

-- CreateIndex
CREATE INDEX "QrLoginSession_expiresAt_idx" ON "QrLoginSession"("expiresAt");
