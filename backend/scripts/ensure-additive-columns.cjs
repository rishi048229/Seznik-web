/**
 * Additive schema patch for production.
 * Does not use `prisma db execute` (Prisma 6 requires --url/--schema and
 * skips .env when prisma.config.ts is present).
 */
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: '/home/ubuntu/Seznik-web/backend/.env' })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })
dotenv.config()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Check backend/.env')
  process.exit(1)
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const STATEMENTS = [
  'ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "labelConfig" JSONB',
  'ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locationConfig" JSONB',
  'ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB',

  // Per-product default discount used by the mobile POS. Missing in production is what made
  // every product create fail with `Unknown argument discountType`.
  'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discountType" TEXT',
  'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discountValue" DOUBLE PRECISION',

  // Remote Printing — a sale keeps a permanent flag once its receipt was printed remotely.
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "isRemotePrint" BOOLEAN NOT NULL DEFAULT false',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "lastRemotePrintJobId" TEXT',
  'CREATE INDEX IF NOT EXISTS "Sale_userId_isRemotePrint_idx" ON "Sale"("userId", "isRemotePrint")',

  // Sale cancel fields from production main (KOT cancel-without-revenue).
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'completed\'',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT',
  'ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)',
  'ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT',
  'ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT',
  'ALTER TABLE "KOTOrderItem" ADD COLUMN IF NOT EXISTS "kotBatchNumber" INTEGER',

  // Remote Printing — per-login push target, so a job can reach one specific agent's phone.
  `CREATE TABLE IF NOT EXISTS "DeviceToken" (
     "id" TEXT NOT NULL,
     "ownerUserId" TEXT NOT NULL,
     "actorId" TEXT NOT NULL,
     "actorName" TEXT NOT NULL,
     "actorIsManagedUser" BOOLEAN NOT NULL DEFAULT false,
     "expoPushToken" TEXT NOT NULL,
     "platform" TEXT NOT NULL DEFAULT 'android',
     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "DeviceToken_ownerUserId_fkey" FOREIGN KEY ("ownerUserId")
       REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_expoPushToken_key" ON "DeviceToken"("expoPushToken")',
  'CREATE INDEX IF NOT EXISTS "DeviceToken_ownerUserId_idx" ON "DeviceToken"("ownerUserId")',
  'CREATE INDEX IF NOT EXISTS "DeviceToken_actorId_idx" ON "DeviceToken"("actorId")',

  // Remote Printing — the request itself.
  `CREATE TABLE IF NOT EXISTS "PrintJob" (
     "id" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "saleId" TEXT NOT NULL,
     "requestedById" TEXT NOT NULL,
     "requestedByName" TEXT NOT NULL,
     "targetAgentId" TEXT,
     "targetAgentName" TEXT,
     "targetLocationId" TEXT,
     "targetLocationName" TEXT,
     "paperWidth" TEXT NOT NULL DEFAULT '58mm',
     "copies" INTEGER NOT NULL DEFAULT 1,
     "status" TEXT NOT NULL DEFAULT 'queued',
     "failureReason" TEXT,
     "acceptedByAgentId" TEXT,
     "acceptedByAgentName" TEXT,
     "expiresAt" TIMESTAMP(3) NOT NULL,
     "respondedAt" TIMESTAMP(3),
     "completedAt" TIMESTAMP(3),
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "PrintJob_userId_fkey" FOREIGN KEY ("userId")
       REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "PrintJob_saleId_fkey" FOREIGN KEY ("saleId")
       REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  'CREATE INDEX IF NOT EXISTS "PrintJob_userId_status_idx" ON "PrintJob"("userId", "status")',
  'CREATE INDEX IF NOT EXISTS "PrintJob_userId_createdAt_idx" ON "PrintJob"("userId", "createdAt")',
  'CREATE INDEX IF NOT EXISTS "PrintJob_targetAgentId_status_idx" ON "PrintJob"("targetAgentId", "status")',
  'CREATE INDEX IF NOT EXISTS "PrintJob_targetLocationId_status_idx" ON "PrintJob"("targetLocationId", "status")',
  'CREATE INDEX IF NOT EXISTS "PrintJob_saleId_idx" ON "PrintJob"("saleId")',

  // Remote Printing — status-transition audit trail.
  `CREATE TABLE IF NOT EXISTS "PrintJobEvent" (
     "id" TEXT NOT NULL,
     "printJobId" TEXT NOT NULL,
     "status" TEXT NOT NULL,
     "note" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "PrintJobEvent_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "PrintJobEvent_printJobId_fkey" FOREIGN KEY ("printJobId")
       REFERENCES "PrintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  'CREATE INDEX IF NOT EXISTS "PrintJobEvent_printJobId_idx" ON "PrintJobEvent"("printJobId")',

  `CREATE TABLE IF NOT EXISTS "KOTPrintEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'kot',
    "itemSnapshot" JSONB NOT NULL,
    "printedByName" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KOTPrintEvent_pkey" PRIMARY KEY ("id")
  )`,
  'CREATE INDEX IF NOT EXISTS "KOTPrintEvent_orderId_idx" ON "KOTPrintEvent"("orderId")',
  'CREATE INDEX IF NOT EXISTS "KOTPrintEvent_userId_idx" ON "KOTPrintEvent"("userId")',
  `CREATE TABLE IF NOT EXISTS "UtilityBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "kioskName" TEXT DEFAULT 'SEZNIK KIOSK',
    "billType" TEXT NOT NULL DEFAULT 'Electricity',
    "provider" TEXT,
    "consumerNumber" TEXT,
    "consumerName" TEXT,
    "dueDate" TEXT,
    "billDate" TEXT,
    "unitsConsumed" TEXT,
    "billAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convenienceFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS (PAID)',
    "paymentMode" TEXT DEFAULT 'CASH',
    "customerPhone" TEXT,
    "operatorName" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UtilityBill_pkey" PRIMARY KEY ("id")
  )`,
  'CREATE INDEX IF NOT EXISTS "UtilityBill_userId_idx" ON "UtilityBill"("userId")',
  'CREATE INDEX IF NOT EXISTS "UtilityBill_userId_createdAt_idx" ON "UtilityBill"("userId", "createdAt")',
  'ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "totalReceived" DOUBLE PRECISION NOT NULL DEFAULT 0',
  'ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "rawText" TEXT',
  'ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "metadata" JSONB',
  'ALTER TABLE "UtilityBill" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP',
]

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql)
    console.log('applied:', sql)
  }

  const saleStatusBackfill = await prisma.$executeRawUnsafe(`
    UPDATE "Sale" SET "status" = 'completed' WHERE "status" IS NULL OR btrim("status") = ''
  `)
  console.log('backfilled Sale.status:', saleStatusBackfill)

  const kotBatchBackfill = await prisma.$executeRawUnsafe(`
    UPDATE "KOTOrderItem"
    SET "kotBatchNumber" = 1
    WHERE "sentToKitchenAt" IS NOT NULL AND "kotBatchNumber" IS NULL
  `)
  console.log('backfilled KOTOrderItem.kotBatchNumber:', kotBatchBackfill)

  const backfilled = await prisma.$executeRawUnsafe(`
    UPDATE "Settings" AS s
    SET "businessName" = u."businessName"
    FROM "User" AS u
    WHERE s."userId" = u.id
      AND (s."businessName" IS NULL OR btrim(s."businessName") = '')
      AND u."businessName" IS NOT NULL
      AND btrim(u."businessName") <> ''
  `)
  console.log('backfilled empty Settings.businessName rows:', backfilled)

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Settings'
      AND column_name IN ('kotConfig', 'locationConfig', 'labelConfig')
    ORDER BY column_name
  `)
  console.log('Settings columns now present:', cols.map((c) => c.column_name).join(', '))

  const productCols = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Product'
      AND column_name IN ('discountType', 'discountValue')
    ORDER BY column_name
  `)
  console.log('Product discount columns now present:', productCols.map((c) => c.column_name).join(', ') || 'NONE — product create will fail')

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('DeviceToken', 'PrintJob', 'PrintJobEvent')
    ORDER BY table_name
  `)
  console.log('Remote print tables now present:', tables.map((t) => t.table_name).join(', ') || 'NONE — remote printing will fail')
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
