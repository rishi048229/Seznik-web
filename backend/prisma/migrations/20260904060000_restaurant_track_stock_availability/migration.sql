-- Restaurant/cafe stock tracking + menu availability (cross-platform persistence)

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Product_userId_isAvailable_idx" ON "Product" ("userId", "isAvailable");

-- Restaurant & cafe profiles do not track inventory quantity.
UPDATE "Settings" AS s
SET "trackStock" = false
FROM "User" AS u
WHERE s."userId" = u.id
  AND u."businessType" = 'restaurant_cafe';

-- Seed non-gating stock for restaurant catalogs (prepared on demand).
UPDATE "Product" AS p
SET "currentStock" = 999999,
    "lowStockThreshold" = 0
FROM "User" AS u
WHERE p."userId" = u.id
  AND u."businessType" = 'restaurant_cafe'
  AND p."currentStock" < 999999;
