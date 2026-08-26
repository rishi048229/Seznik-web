-- Additive web KOT fields. Safe on databases that already have some of these.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "kotConfig" JSONB;

ALTER TABLE "RestaurantTable" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "waiterName" TEXT;
ALTER TABLE "KOTOrder" ADD COLUMN IF NOT EXISTS "locationId" TEXT;

ALTER TABLE "KOTOrderItem" ADD COLUMN IF NOT EXISTS "sentToKitchenAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KOTOrder_locationId_fkey'
  ) THEN
    ALTER TABLE "KOTOrder"
      ADD CONSTRAINT "KOTOrder_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
