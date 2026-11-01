BEGIN;
CREATE TABLE "PendingRegistration" (
  "email" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PendingRegistration_username_key" ON "PendingRegistration"("username");
CREATE UNIQUE INDEX "PendingRegistration_tokenHash_key" ON "PendingRegistration"("tokenHash");
CREATE INDEX "PendingRegistration_expiresAt_idx" ON "PendingRegistration"("expiresAt");
ALTER TABLE "PendingRegistration" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "AuthRateLimit" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthRateLimit_expiresAt_idx" ON "AuthRateLimit"("expiresAt");
ALTER TABLE "AuthRateLimit" ENABLE ROW LEVEL SECURITY;
COMMIT;
