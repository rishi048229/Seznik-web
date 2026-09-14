import prisma from '../config/db'

const ADDITIVE_COLUMNS = [
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "labelConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locationConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB`,
] as const

let ensured: Promise<void> | null = null

const runEnsure = async () => {
  for (const sql of ADDITIVE_COLUMNS) {
    await prisma.$executeRawUnsafe(sql)
  }

  await prisma.$executeRawUnsafe(`
    UPDATE "Settings" AS s
    SET "businessName" = u."businessName"
    FROM "User" AS u
    WHERE s."userId" = u.id
      AND (s."businessName" IS NULL OR btrim(s."businessName") = '')
      AND u."businessName" IS NOT NULL
      AND btrim(u."businessName") <> ''
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UtilityBill" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "receiptNumber" TEXT NOT NULL,
      "kioskName" TEXT NOT NULL DEFAULT '',
      "billType" TEXT NOT NULL DEFAULT 'UTILITY',
      "provider" TEXT NOT NULL DEFAULT '',
      "consumerNumber" TEXT NOT NULL DEFAULT '',
      "consumerName" TEXT NOT NULL DEFAULT '',
      "dueDate" TEXT,
      "billDate" TEXT,
      "unitsConsumed" TEXT,
      "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "convenienceFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'SUCCESS (PAID)',
      "paymentMode" TEXT NOT NULL DEFAULT 'CASH',
      "customerPhone" TEXT,
      "operatorName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UtilityBill_pkey" PRIMARY KEY ("id")
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UtilityBill_userId_idx" ON "UtilityBill"("userId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UtilityBill_userId_createdAt_idx" ON "UtilityBill"("userId", "createdAt")`)
}

export const ensureAdditiveSchema = async () => {
  if (!ensured) {
    ensured = runEnsure().catch((err) => {
      ensured = null
      throw err
    })
  }
  return ensured
}

export const resetAdditiveSchemaCache = () => {
  ensured = null
}
