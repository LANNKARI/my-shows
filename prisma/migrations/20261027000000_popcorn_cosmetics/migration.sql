-- Additive: balances, uploaded covers and viewing progress are preserved.
BEGIN;
ALTER TABLE "User" ADD COLUMN "avatarFrame" TEXT NOT NULL DEFAULT 'frame-standard',
  ADD COLUMN "profileStyle" TEXT NOT NULL DEFAULT 'profile-standard';
CREATE TABLE "CosmeticPurchase" (
  "id" SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "itemId" TEXT NOT NULL,
  "pricePaid" INTEGER NOT NULL CHECK ("pricePaid" >= 0),
  "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CosmeticPurchase_userId_itemId_key" ON "CosmeticPurchase"("userId", "itemId");
ALTER TABLE "CosmeticPurchase" ENABLE ROW LEVEL SECURITY;
COMMIT;
