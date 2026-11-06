-- Historical timestamps can originate in a backup; never treat them as verified activity.
ALTER TABLE "EpisodeProgress" ADD COLUMN "statisticsSource" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "EpisodeProgress" ADD CONSTRAINT "EpisodeProgress_statisticsSource_check" CHECK ("statisticsSource" IN ('legacy','manual','import'));
