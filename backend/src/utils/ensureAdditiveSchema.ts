import prisma from '../config/db'

const ADDITIVE_COLUMNS = [
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "labelConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locationConfig" JSONB`,
  `ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB`,
] as const

export const ensureAdditiveSchema = async () => {
  for (const sql of ADDITIVE_COLUMNS) {
    await prisma.$executeRawUnsafe(sql)
  }

  // Restore store names that were never copied onto Settings (or look blank
  // because settings GET was failing). Only fills empty Settings.businessName.
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
