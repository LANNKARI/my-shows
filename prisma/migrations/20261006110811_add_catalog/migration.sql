/*
  Warnings:

  - A unique constraint covering the columns `[showId,season,episode]` on the table `Episode` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Comment_titleId_idx";

-- DropIndex
DROP INDEX "Episode_titleId_season_episode_key";

-- AlterTable
ALTER TABLE "CollectionItem" ADD COLUMN     "showId" INTEGER,
ALTER COLUMN "titleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "showId" INTEGER,
ALTER COLUMN "titleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "showId" INTEGER,
ALTER COLUMN "titleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "userShowId" INTEGER,
ALTER COLUMN "titleId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Show" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "description" TEXT,
    "posterUrl" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'series',
    "tmdbId" INTEGER,
    "year" TEXT,
    "releaseDate" TIMESTAMP(3),
    "runtime" INTEGER,
    "budget" BIGINT,
    "revenue" BIGINT,
    "countries" TEXT[],
    "studios" TEXT[],
    "genres" TEXT[],
    "director" TEXT,
    "creators" TEXT[],
    "cast" JSONB,
    "tmdbRating" DOUBLE PRECISION,
    "tmdbVotes" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserShow" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "showId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'series',
    "totalSeasons" INTEGER NOT NULL DEFAULT 1,
    "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "dubbing" TEXT,
    "watchSite" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserShow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeProgress" (
    "id" SERIAL NOT NULL,
    "userShowId" INTEGER NOT NULL,
    "episodeId" INTEGER NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "stoppedAt" TEXT,
    "watchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Show_name_idx" ON "Show"("name");

-- CreateIndex
CREATE INDEX "Show_tmdbId_idx" ON "Show"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Show_tmdbId_kind_key" ON "Show"("tmdbId", "kind");

-- CreateIndex
CREATE INDEX "UserShow_userId_idx" ON "UserShow"("userId");

-- CreateIndex
CREATE INDEX "UserShow_showId_idx" ON "UserShow"("showId");

-- CreateIndex
CREATE UNIQUE INDEX "UserShow_userId_showId_key" ON "UserShow"("userId", "showId");

-- CreateIndex
CREATE INDEX "EpisodeProgress_userShowId_idx" ON "EpisodeProgress"("userShowId");

-- CreateIndex
CREATE INDEX "EpisodeProgress_episodeId_idx" ON "EpisodeProgress"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeProgress_userShowId_episodeId_key" ON "EpisodeProgress"("userShowId", "episodeId");

-- CreateIndex
CREATE INDEX "CollectionItem_showId_idx" ON "CollectionItem"("showId");

-- CreateIndex
CREATE INDEX "Comment_showId_idx" ON "Comment"("showId");

-- CreateIndex
CREATE INDEX "Episode_showId_idx" ON "Episode"("showId");

-- CreateIndex
CREATE INDEX "Episode_titleId_idx" ON "Episode"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_showId_season_episode_key" ON "Episode"("showId", "season", "episode");

-- CreateIndex
CREATE INDEX "Rating_userShowId_idx" ON "Rating"("userShowId");

-- CreateIndex
CREATE INDEX "Rating_titleId_idx" ON "Rating"("titleId");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userShowId_fkey" FOREIGN KEY ("userShowId") REFERENCES "UserShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShow" ADD CONSTRAINT "UserShow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShow" ADD CONSTRAINT "UserShow_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeProgress" ADD CONSTRAINT "EpisodeProgress_userShowId_fkey" FOREIGN KEY ("userShowId") REFERENCES "UserShow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeProgress" ADD CONSTRAINT "EpisodeProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
