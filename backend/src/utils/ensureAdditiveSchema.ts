import prisma from '../config/db'

const ADDITIVE_COLUMNS = [
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "labelConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locationConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true`,
] as const

const ADDITIVE_TABLES = [
  `
  CREATE TABLE IF NOT EXISTS "ApiUsageBucket" (
    "id" TEXT PRIMARY KEY,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "featureKey" TEXT NOT NULL,
    "routePrefix" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
  `,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ApiUsageBucket_bucket_feature_route_method_type_key"
    ON "ApiUsageBucket" ("bucketStart", "featureKey", "routePrefix", "method", "businessType")`,
  `CREATE INDEX IF NOT EXISTS "ApiUsageBucket_bucketStart_idx" ON "ApiUsageBucket" ("bucketStart")`,
  `CREATE INDEX IF NOT EXISTS "ApiUsageBucket_businessType_bucketStart_idx"
    ON "ApiUsageBucket" ("businessType", "bucketStart")`,
  `CREATE INDEX IF NOT EXISTS "ApiUsageBucket_featureKey_bucketStart_idx"
    ON "ApiUsageBucket" ("featureKey", "bucketStart")`,
  `
  CREATE TABLE IF NOT EXISTS "UtilityBill" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "billType" TEXT NOT NULL DEFAULT 'Electricity',
    "provider" TEXT,
    "consumerNumber" TEXT,
    "consumerName" TEXT,
    "dueDate" TEXT,
    "unitsConsumed" TEXT,
    "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convenienceFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS (PAID)',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UtilityBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS "UtilityBill_userId_idx" ON "UtilityBill" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "UtilityBill_userId_date_idx" ON "UtilityBill" ("userId", "date")`,
  `CREATE INDEX IF NOT EXISTS "UtilityBill_consumerNumber_idx" ON "UtilityBill" ("consumerNumber")`,
] as const

let ensured: Promise<void> | null = null

const runEnsure = async () => {
  for (const sql of ADDITIVE_COLUMNS) {
    await prisma.$executeRawUnsafe(sql)
  }

  for (const sql of ADDITIVE_TABLES) {
    await prisma.$executeRawUnsafe(sql)
  }

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Product_userId_isAvailable_idx" ON "Product" ("userId", "isAvailable")
  `)

  // Keep Settings.trackStock aligned with restaurant_cafe business profiles.
  await prisma.$executeRawUnsafe(`
    UPDATE "Settings" AS s
    SET "trackStock" = false
    FROM "User" AS u
    WHERE s."userId" = u.id
      AND u."businessType" = 'restaurant_cafe'
      AND s."trackStock" = true
  `)

  await prisma.$executeRawUnsafe(`
    UPDATE "Settings" AS s
    SET "businessName" = u."businessName"
    FROM "User" AS u
    WHERE s."userId" = u.id
      AND (s."businessName" IS NULL OR btrim(s."businessName") = '')
      AND u."businessName" IS NOT NULL
      AND btrim(u."businessName") <> ''
  `)
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
