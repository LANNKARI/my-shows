CREATE TABLE "PromoCode" (
 "id" SERIAL PRIMARY KEY,
 "code" VARCHAR(64) NOT NULL,
 "reward" INTEGER NOT NULL CHECK ("reward" > 0 AND "reward" <= 1000000),
 "active" BOOLEAN NOT NULL DEFAULT false,
 "startsAt" TIMESTAMP(3),
 "expiresAt" TIMESTAMP(3),
 "maxActivations" INTEGER CHECK ("maxActivations" IS NULL OR "maxActivations" > 0),
 "redeemedCount" INTEGER NOT NULL DEFAULT 0 CHECK ("redeemedCount" >= 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'),
 CHECK ("startsAt" IS NULL OR "expiresAt" IS NULL OR "expiresAt" > "startsAt"),
 CHECK ("maxActivations" IS NULL OR "redeemedCount" <= "maxActivations")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE TABLE "PromoRedemption" (
 "id" SERIAL PRIMARY KEY,
 "promoCodeId" INTEGER NOT NULL REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "amount" INTEGER NOT NULL CHECK ("amount" > 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PromoRedemption_promoCodeId_userId_key" ON "PromoRedemption"("promoCodeId", "userId");
CREATE INDEX "PromoRedemption_userId_createdAt_idx" ON "PromoRedemption"("userId", "createdAt");
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoRedemption" ENABLE ROW LEVEL SECURITY;
