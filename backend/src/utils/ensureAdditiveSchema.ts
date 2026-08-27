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
