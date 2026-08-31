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
]

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql)
    console.log('applied:', sql)
  }

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
