-- Additive only. Never DROP or rewrite existing rows.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "labelConfig" JSONB;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "locationConfig" JSONB;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB;
