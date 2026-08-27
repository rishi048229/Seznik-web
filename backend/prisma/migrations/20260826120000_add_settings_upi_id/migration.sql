-- Additive: store merchant UPI VPA on Settings (used by UPI receipt QR and checkout).
-- Safe if the column already exists from a prior live-DB introspection.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
