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
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT \'completed\'',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)',
  'ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT',
  'ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3)',
  'ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT',
  'ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "cancelledByName" TEXT',
  'ALTER TABLE "KOTOrderItem" ADD COLUMN IF NOT EXISTS "kotBatchNumber" INTEGER',
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
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
