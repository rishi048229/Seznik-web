import prisma from '../config/db'

const ADDITIVE_COLUMNS = [
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "labelConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locationConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "kioskName" TEXT`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "operatorName" TEXT`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "billDate" TEXT`,
  `ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT DEFAULT 'CASH'`,
  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "returnStatus" TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "totalReturned" DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "supplierBillNumber" TEXT`,
  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'paid'`,
  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "paymentDueDate" TIMESTAMP(3)`,
  `ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "payableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0`,
] as const

const ADDITIVE_TABLES = [
  `
  CREATE TABLE IF NOT EXISTS "SupplierTransaction" (
    "id" TEXT PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierTransaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS "SupplierTransaction_userId_idx" ON "SupplierTransaction" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "SupplierTransaction_supplierId_createdAt_idx" ON "SupplierTransaction" ("supplierId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Supplier_userId_payableBalance_idx" ON "Supplier" ("userId", "payableBalance")`,
  `CREATE INDEX IF NOT EXISTS "Purchase_userId_paymentStatus_idx" ON "Purchase" ("userId", "paymentStatus")`,
  `CREATE INDEX IF NOT EXISTS "Purchase_userId_supplierId_idx" ON "Purchase" ("userId", "supplierId")`,
  `
  CREATE TABLE IF NOT EXISTS "PurchaseReturn" (
    "id" TEXT PRIMARY KEY,
    "returnNumber" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "supplierId" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "totalTax" DOUBLE PRECISION NOT NULL,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "settlementMethod" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "locationId" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseReturn_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PurchaseReturn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS "PurchaseReturn_userId_createdAt_idx" ON "PurchaseReturn" ("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "PurchaseReturn_purchaseId_idx" ON "PurchaseReturn" ("purchaseId")`,
  `CREATE INDEX IF NOT EXISTS "PurchaseReturn_supplierId_idx" ON "PurchaseReturn" ("supplierId")`,
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
  `CREATE INDEX IF NOT EXISTS "UtilityBill_receiptNumber_idx" ON "UtilityBill" ("receiptNumber")`,
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

  await prisma.$executeRawUnsafe(`
    UPDATE "Settings" AS s
    SET "personalInfo" = jsonb_build_object(
      'ownerName', COALESCE(u."displayName", ''),
      'ownerPhone', COALESCE(s."businessPhone", u."phone", ''),
      'ownerAddress', COALESCE(s."businessAddress", '')
    )
    FROM "User" AS u
    WHERE s."userId" = u.id
      AND (
        s."personalInfo" IS NULL
        OR s."personalInfo"->>'ownerName' IS NULL
        OR btrim(s."personalInfo"->>'ownerName') = ''
      )
      AND u."displayName" IS NOT NULL
      AND btrim(u."displayName") <> ''
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
