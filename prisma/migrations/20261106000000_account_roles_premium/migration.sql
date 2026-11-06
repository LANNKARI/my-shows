ALTER TABLE "User" ADD COLUMN "premiumBonusTenths" INTEGER NOT NULL DEFAULT 0 CHECK ("premiumBonusTenths" BETWEEN 0 AND 9);
CREATE TABLE "SiteOwner" (id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1), "userId" TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE RESTRICT);
CREATE TABLE "SiteRole" (id TEXT PRIMARY KEY, name VARCHAR(40) NOT NULL UNIQUE, color VARCHAR(7) NOT NULL DEFAULT '#c1a4ff', icon VARCHAR(8) NOT NULL DEFAULT '✦', permissions TEXT[] NOT NULL DEFAULT '{}');
CREATE TABLE "UserRole" ("userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,"roleId" TEXT NOT NULL REFERENCES "SiteRole"(id) ON DELETE CASCADE,"expiresAt" TIMESTAMP(3),PRIMARY KEY("userId","roleId"));
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE TABLE "PremiumPeriod" (id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,"requestKey" TEXT NOT NULL,"startsAt" TIMESTAMP(3) NOT NULL,"endsAt" TIMESTAMP(3) NOT NULL,source TEXT NOT NULL,"bonusPaidAt" TIMESTAMP(3),"revokedAt" TIMESTAMP(3),CHECK("endsAt">"startsAt"));
CREATE UNIQUE INDEX "PremiumPeriod_userId_requestKey_key" ON "PremiumPeriod"("userId","requestKey");
CREATE INDEX "PremiumPeriod_userId_revokedAt_startsAt_endsAt_idx" ON "PremiumPeriod"("userId","revokedAt","startsAt","endsAt");
CREATE TABLE "AdminAudit" (id SERIAL PRIMARY KEY,"actorId" TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE "AdminAudit" ADD COLUMN "requestKey" TEXT UNIQUE;
CREATE INDEX "AdminAudit_createdAt_idx" ON "AdminAudit"("createdAt");
ALTER TABLE "SiteOwner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PremiumPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAudit" ENABLE ROW LEVEL SECURITY;
INSERT INTO "SiteRole" (id,name,color,icon,permissions) VALUES
('moderator','Модератор','#9bcbb6','◆',ARRAY['moderate_comments']),
('curator','Куратор','#9dbde3','◈',ARRAY['curate']),
('tester','Тестировщик','#b5a2e0','✧',ARRAY['beta']),
('pioneer','Первопроходец','#caaf70','★',ARRAY[]::text[]);
-- Ownership is bootstrapped separately against the verified account ID, never at login/registration.

CREATE TABLE "EditorialPick" (id TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,name VARCHAR(100) NOT NULL,description VARCHAR(1000) NOT NULL,"showIds" INTEGER[] NOT NULL,published BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "EditorialPick_userId_idx" ON "EditorialPick"("userId");
CREATE INDEX "EditorialPick_published_updatedAt_idx" ON "EditorialPick"(published,"updatedAt");
ALTER TABLE "EditorialPick" ENABLE ROW LEVEL SECURITY;
