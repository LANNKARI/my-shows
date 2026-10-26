-- Additive: account data and viewing progress are preserved.
BEGIN;
ALTER TABLE "User" ADD COLUMN "releaseNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyNewShows" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notificationTimeZone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Episode" ADD COLUMN "airDate" DATE, ADD COLUMN "name" TEXT;
ALTER TABLE "Show" ADD COLUMN "calendarSyncedAt" TIMESTAMP(3),
  ADD COLUMN "calendarAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "calendarSyncFrom" DATE, ADD COLUMN "calendarSyncTo" DATE;
ALTER TABLE "UserShow" ADD COLUMN "notifyReleases" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notifySince" DATE;
CREATE TABLE "ReleaseNotification" (
  "id" SERIAL PRIMARY KEY,
  "userShowId" INTEGER NOT NULL REFERENCES "UserShow"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "episodeId" INTEGER NOT NULL REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3)
);
-- Private server-side data: Supabase Data API roles receive no row policy.
ALTER TABLE "ReleaseNotification" ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX "ReleaseNotification_userShowId_episodeId_key" ON "ReleaseNotification"("userShowId", "episodeId");
CREATE INDEX "ReleaseNotification_userShowId_readAt_idx" ON "ReleaseNotification"("userShowId", "readAt");
CREATE INDEX "Episode_showId_airDate_idx" ON "Episode"("showId", "airDate");
COMMIT;
