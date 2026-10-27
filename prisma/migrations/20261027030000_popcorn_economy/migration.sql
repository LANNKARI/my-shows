BEGIN;
CREATE TABLE "PopcornEntry" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "eventKey" TEXT NOT NULL, "category" TEXT NOT NULL, "amount" INTEGER NOT NULL, "reason" TEXT NOT NULL,
 "day" DATE NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PopcornEntry_userId_eventKey_key" ON "PopcornEntry"("userId", "eventKey");
CREATE INDEX "PopcornEntry_userId_day_category_idx" ON "PopcornEntry"("userId", "day", "category");
ALTER TABLE "PopcornEntry" ENABLE ROW LEVEL SECURITY;
-- Opening balances describe existing currency; they do not increment it.
INSERT INTO "PopcornEntry" ("id","userId","eventKey","category","amount","reason","day")
 SELECT 'opening:' || "id", "id", 'opening', 'opening', "popcorn", 'Баланс до обновления', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date FROM "User";
-- Persistent baselines block rewards for actions that already existed at rollout.
INSERT INTO "PopcornEntry" ("id","userId","eventKey","category","amount","reason","day")
SELECT 'legacy:progress:' || p."id", u."userId",
 'watch:' || s."kind" || ':' || CASE WHEN s."tmdbId" IS NOT NULL THEN 'tmdb:' || s."tmdbId" ELSE 'show:' || s."id" END || CASE WHEN s."kind"='movie' THEN '' ELSE ':' || e."season" || ':' || e."episode" END,
 'legacy', 0, 'Просмотр до обновления', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
FROM "EpisodeProgress" p JOIN "UserShow" u ON u."id"=p."userShowId" JOIN "Episode" e ON e."id"=p."episodeId" JOIN "Show" s ON s."id"=u."showId"
WHERE p."watched"=true AND e."showId"=s."id" ON CONFLICT ("userId","eventKey") DO NOTHING;
INSERT INTO "PopcornEntry" ("id","userId","eventKey","category","amount","reason","day")
SELECT 'legacy:movie:' || u."id",u."userId",'watch:movie:' || CASE WHEN s."tmdbId" IS NOT NULL THEN 'tmdb:' || s."tmdbId" ELSE 'show:' || s."id" END,
 'legacy',0,'Фильм до обновления',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
FROM "UserShow" u JOIN "Show" s ON s."id"=u."showId" WHERE s."kind"='movie' AND u."status"='completed' ON CONFLICT ("userId","eventKey") DO NOTHING;
INSERT INTO "PopcornEntry" ("id","userId","eventKey","category","amount","reason","day")
SELECT 'legacy:rating:' || r."id",u."userId",'rating:' || s."kind" || ':' || CASE WHEN s."tmdbId" IS NOT NULL THEN 'tmdb:' || s."tmdbId" ELSE 'show:' || s."id" END,
 'legacy',0,'Оценка до обновления',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
FROM "Rating" r JOIN "UserShow" u ON u."id"=r."userShowId" JOIN "Show" s ON s."id"=u."showId" WHERE r."episodeId" IS NULL ON CONFLICT ("userId","eventKey") DO NOTHING;
INSERT INTO "PopcornEntry" ("id","userId","eventKey","category","amount","reason","day")
SELECT 'legacy:review:' || c."id",c."userId",'review:' || s."kind" || ':' || CASE WHEN s."tmdbId" IS NOT NULL THEN 'tmdb:' || s."tmdbId" ELSE 'show:' || s."id" END,
 'legacy',0,'Отзыв до обновления',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
FROM "Comment" c JOIN "Show" s ON s."id"=c."showId" WHERE char_length(c."text")>=100 ON CONFLICT ("userId","eventKey") DO NOTHING;
CREATE TABLE "PopcornQuizRound" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "data" JSONB NOT NULL, "answered" BOOLEAN NOT NULL DEFAULT false, "correct" BOOLEAN NOT NULL DEFAULT false,
 "streak" INTEGER NOT NULL DEFAULT 0, "reward" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PopcornQuizRound_userId_createdAt_idx" ON "PopcornQuizRound"("userId","createdAt");
ALTER TABLE "PopcornQuizRound" ENABLE ROW LEVEL SECURITY;
COMMIT;
