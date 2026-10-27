import { recordQuizAttempt, nextDailyStreak } from '../src/lib/daily-popcorn';
import { calendarRange, addDays, todayInZone, dayDate, validDay } from '../src/lib/calendar-dates';
import { syncShowSchedule, scheduleDue } from '../src/lib/release-schedule';
import { materializeReleases } from '../src/lib/release-notifications';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { config } from 'dotenv';
import { answerDuel, createDuel, publicDuel, type DuelState } from '../src/lib/higher-lower';
import { signProgressUndo, verifyProgressUndo, type ProgressUndo } from '../src/lib/progress-undo';

config({ path: '.env.local', quiet: true });
const schema = `test_security_${process.pid}_${Date.now()}`;
const database = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost'].includes(database.hostname)) throw new Error('Security tests require a local PostgreSQL instance');
database.searchParams.set('schema', schema);
const databaseUrl = database.toString();
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const base = `http://127.0.0.1:${process.env.SECURITY_TEST_PORT || '3317'}`;
let server: ChildProcess | undefined;
let serverOutput = '';
let seeded = false;
let nextEnv: string | undefined;
const uploads: string[] = [];
const password = randomBytes(24).toString('base64url');
let alice: { id: string; username: string; email: string };
let bob: typeof alice;
let showId: number;
let ownLibraryId: number;
let ownProgressId: number;
let foreignProgressId: number;
let otherEpisodeId: number;

class Client {
  cookies = new Map<string, string>();
  async request(path: string, method = 'GET', body?: object | FormData | URLSearchParams) {
    const headers: Record<string, string> = {};
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const raw = body instanceof FormData || body instanceof URLSearchParams;
    if (body && !raw) headers['content-type'] = 'application/json';
    const res = await fetch(base + path, { method, headers, redirect: 'manual', body: body ? raw ? body as FormData | URLSearchParams : JSON.stringify(body) : undefined });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const pos = pair.indexOf('=');
      this.cookies.set(pair.slice(0, pos), pair.slice(pos + 1));
    }
    return res;
  }
  async login(user: typeof alice) {
    const csrf = await (await this.request('/api/auth/csrf')).json();
    await this.request('/api/auth/callback/credentials', 'POST', new URLSearchParams({ csrfToken: csrf.csrfToken, email: user.email, password, callbackUrl: base }));
    const session = await (await this.request('/api/auth/session')).json();
    assert.equal(session?.user?.id, user.id, 'real credentials session established');
  }
}
const guest = new Client();
const owner = new Client();
const other = new Client();

before(async () => {
  nextEnv = await readFile('next-env.d.ts', 'utf8').catch(() => undefined);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  seeded = true;
  const setup = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.stderr);
  // Exercise the additive migration against the pre-change schema as well.
  await prisma.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "higherLowerState"');
  await prisma.$executeRawUnsafe(await readFile('prisma/migrations/20261022000000_secure_higher_lower_state/migration.sql', 'utf8'));
  // Exercise the calendar migration against a populated pre-calendar schema.
  const legacyUser = await prisma.user.create({ data: { email: 'migration@example.test', username: 'migration_fixture' } });
  const legacyShow = await prisma.show.create({ data: { name: 'Migration fixture', kind: 'series', episodes: { create: { season: 1, episode: 1 } } }, include: { episodes: true } });
  const legacyEntry = await prisma.userShow.create({ data: { userId: legacyUser.id, showId: legacyShow.id, dubbing: 'Сохранить' } });
  const legacyProgress = await prisma.episodeProgress.create({ data: { userShowId: legacyEntry.id, episodeId: legacyShow.episodes[0].id, watched: true, watchedAt: new Date('2025-01-02T10:00:00Z') } });
  const calendarMigration = await readFile('prisma/migrations/20261026000000_release_calendar/migration.sql', 'utf8');
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('DROP TABLE "ReleaseNotification"');
    await tx.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "releaseNotificationsEnabled", DROP COLUMN "notifyNewShows", DROP COLUMN "notificationTimeZone"');
    await tx.$executeRawUnsafe('ALTER TABLE "UserShow" DROP COLUMN "notifyReleases", DROP COLUMN "notifySince"');
    await tx.$executeRawUnsafe('ALTER TABLE "Show" DROP COLUMN "calendarSyncedAt", DROP COLUMN "calendarAttemptedAt", DROP COLUMN "calendarSyncFrom", DROP COLUMN "calendarSyncTo"');
    await tx.$executeRawUnsafe('ALTER TABLE "Episode" DROP COLUMN "airDate", DROP COLUMN "name"');
    for (const statement of calendarMigration.replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(value => value && !['BEGIN', 'COMMIT'].includes(value))) await tx.$executeRawUnsafe(statement);
  });
  assert.deepEqual(await prisma.episodeProgress.findUniqueOrThrow({ where: { id: legacyProgress.id } }), legacyProgress);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: legacyEntry.id } })).dubbing, 'Сохранить');
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: legacyEntry.id } })).notifyReleases, false);
  const rls = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ${schema} AND c.relname = 'ReleaseNotification'`;
  assert.equal(rls[0].relrowsecurity, true);
  // Cosmetic migration is additive and preserves existing balances and uploaded covers.
  await prisma.user.update({ where: { id: legacyUser.id }, data: { popcorn: 321, bannerUrl: 'https://example.test/cover.png' } });
  const cosmeticMigration = await readFile('prisma/migrations/20261027000000_popcorn_cosmetics/migration.sql', 'utf8');
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('DROP TABLE "CosmeticPurchase"');
    await tx.$executeRawUnsafe('ALTER TABLE "User" DROP COLUMN "avatarFrame", DROP COLUMN "profileStyle"');
    for (const statement of cosmeticMigration.replace(/^--.*$/gm, '').split(';').map(value => value.trim()).filter(value => value && !['BEGIN', 'COMMIT'].includes(value))) await tx.$executeRawUnsafe(statement);
  });
  const preserved = await prisma.user.findUniqueOrThrow({ where: { id: legacyUser.id } });
  assert.equal(preserved.popcorn, 321); assert.equal(preserved.bannerUrl, 'https://example.test/cover.png');
  assert.equal(preserved.avatarFrame, 'frame-standard'); assert.equal(preserved.profileStyle, 'profile-standard');
  assert.deepEqual(await prisma.episodeProgress.findUniqueOrThrow({ where: { id: legacyProgress.id } }), legacyProgress);
  const cosmeticRls = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ${schema} AND c.relname = 'CosmeticPurchase'`;
  assert.equal(cosmeticRls[0].relrowsecurity, true);
  await prisma.user.delete({ where: { id: legacyUser.id } }); await prisma.show.delete({ where: { id: legacyShow.id } });
  const passwordHash = await bcrypt.hash(password, 10);
  alice = await prisma.user.create({ data: { username: 'security_alice', email: 'alice@example.test', passwordHash } });
  bob = await prisma.user.create({ data: { username: 'security_bob', email: 'bob@example.test', passwordHash } });
  const show = await prisma.show.create({ data: { name: 'Security test series', kind: 'series', countries: [], studios: [], genres: [], creators: [], episodes: { create: [{ season: 1, episode: 1 }, { season: 1, episode: 2 }] } }, include: { episodes: true } });
  showId = show.id;
  const ownLibrary = await prisma.userShow.create({ data: { userId: alice.id, showId, totalEpisodes: 2 } });
  ownLibraryId = ownLibrary.id;
  const foreignLibrary = await prisma.userShow.create({ data: { userId: bob.id, showId } });
  ownProgressId = (await prisma.episodeProgress.create({ data: { userShowId: ownLibrary.id, episodeId: show.episodes[0].id } })).id;
  foreignProgressId = (await prisma.episodeProgress.create({ data: { userShowId: foreignLibrary.id, episodeId: show.episodes[0].id } })).id;
  const otherShow = await prisma.show.create({ data: { name: 'Another test', kind: 'series', countries: [], studios: [], genres: [], creators: [], episodes: { create: { season: 1, episode: 1 } } }, include: { episodes: true } });
  otherEpisodeId = otherShow.episodes[0].id;
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', new URL(base).port], {
    detached: true,
    env: { ...process.env, DATABASE_URL: databaseUrl, AUTH_SECRET: randomBytes(32).toString('hex'), TMDB_API_KEY: '', TMDB_READ_ACCESS_TOKEN: '', NEXT_PUBLIC_TMDB_API_KEY: '', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Next startup timeout')), 45000);
    const capture = (data: Buffer) => {
      serverOutput += data.toString();
      if (serverOutput.includes('Ready in')) { clearTimeout(timer); resolve(); }
    };
    server!.stdout!.on('data', capture);
    server!.stderr!.on('data', capture);
    server!.once('exit', () => { clearTimeout(timer); reject(new Error('Next server failed to start')); });
    server!.once('error', reject);
  });
  assert.equal((await guest.request('/api/ping')).status, 200);
  await owner.login(alice);
  await other.login(bob);
}, { timeout: 60000 });

after(async () => {
  if (server?.pid && server.exitCode === null) {
    const exit = once(server, 'exit');
    process.kill(-server.pid, 'SIGTERM');
    await exit;
  }
  for (const file of uploads) await unlink(file).catch(() => undefined);
  if (nextEnv !== undefined) await writeFile('next-env.d.ts', nextEnv);
  if (seeded) await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await prisma.$disconnect();
});

test('anonymous requests cannot read or change private data even with accounts in the database', async () => {
  for (const path of ['/api/users/me', '/api/export', '/api/shows', '/api/user-shows', '/api/collections', '/api/higher-lower']) assert.equal((await guest.request(path)).status, 401, path);
  assert.equal((await guest.request('/api/users/me', 'PATCH', { name: 'intruder' })).status, 401);
  assert.equal((await guest.request(`/api/users/${alice.username}/banner`, 'POST', { bannerUrl: null })).status, 401);
  assert.equal((await guest.request('/api/higher-lower', 'POST', { action: 'cashout', currentBank: 999999 })).status, 401);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).name, null);
});

test('profile API exposes only safe fields and the logged-in identity', async () => {
  for (const [client, user] of [[owner, alice], [other, bob]] as const) {
    const response = await client.request('/api/users/me');
    assert.equal(response.status, 200);
    const profile = await response.json();
    assert.equal(profile.id, user.id);
    for (const field of ['passwordHash', 'higherLowerState', 'providerId', 'emailVerified']) assert.equal(field in profile, false, field);
  }
});

test('read-only library includes dropped titles, keeps personal ratings separate and remains owner-scoped', async () => {
  const show = await prisma.show.create({ data: { name: 'Archived library fixture', kind: 'series', countries: [], studios: [], genres: [], creators: [], tmdbRating: 9.8, episodes: { create: { season: 1, episode: 1 } } }, include: { episodes: true } });
  const entry = await prisma.userShow.create({ data: { userId: alice.id, showId: show.id, status: 'dropped', totalEpisodes: 0 } });
  const foreign = await prisma.userShow.create({ data: { userId: bob.id, showId: show.id, status: 'dropped' } });
  await prisma.rating.createMany({ data: [{ userShowId: entry.id, score: 10, episodeId: show.episodes[0].id }, { userShowId: entry.id, score: 6, episodeId: null }] });
  const response = await owner.request('/api/user-shows?status=library');
  assert.equal(response.status, 200);
  const data = await response.json();
  const item = data.find((item: { userShowId: number }) => item.userShowId === entry.id);
  assert.equal(item.status, 'dropped'); assert.equal(item.userRating, 6); assert.equal(item.tmdbRating, 9.8);
  assert.equal(data.some((item: { userShowId: number }) => item.userShowId === foreign.id), false);
  const after = await prisma.userShow.findUniqueOrThrow({ where: { id: entry.id } });
  assert.equal(after.totalEpisodes, 0); assert.equal(after.updatedAt.toISOString(), entry.updatedAt.toISOString());
  const legacy = await (await owner.request('/api/user-shows?status=all')).json();
  assert.equal(legacy.some((item: { userShowId: number }) => item.userShowId === entry.id), false);
  assert.equal((await guest.request('/api/user-shows?status=library')).status, 401);
  assert.equal((await owner.request('/api/user-shows?status=invalid')).status, 400);
});

test('tracker exposes the current revision and whole-title rating without counting foreign episodes', async () => {
  const f = await quickFixture();
  await prisma.rating.createMany({ data: [{ userShowId: f.entry.id, episodeId: f.show.episodes[0].id, score: 10 }, { userShowId: f.entry.id, episodeId: null, score: 6 }] });
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: otherEpisodeId, watched: true } });
  const response = await owner.request(`/api/user-shows/${f.show.id}`);
  assert.equal(response.status, 200);
  const tracker = await response.json();
  const record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } });
  assert.equal(tracker.userShow.id, f.entry.id);
  assert.equal(tracker.userShow.updatedAt, record.updatedAt.toISOString());
  assert.equal(tracker.userShow.userRating, 6);
  assert.equal(tracker.stats.watchedEpisodesCount, 0);
  const marked = await owner.request(f.path, 'POST', { action: 'mark', expectedUpdatedAt: tracker.userShow.updatedAt, expectedEpisodeId: tracker.seasons[0].episodes[0].id });
  assert.equal(marked.status, 200);
});

test('episode updates are scoped to the owning library record', async () => {
  assert.equal((await owner.request(`/api/user-shows/${ownLibraryId}/episodes/${foreignProgressId}`, 'PATCH', { watched: true })).status, 404);
  assert.equal((await prisma.episodeProgress.findUniqueOrThrow({ where: { id: foreignProgressId } })).watched, false);
  assert.equal((await owner.request(`/api/user-shows/${ownLibraryId}/episodes/${ownProgressId}`, 'PATCH', { watched: true })).status, 200);
  assert.equal((await prisma.episodeProgress.findUniqueOrThrow({ where: { id: ownProgressId } })).watched, true);
  assert.equal((await owner.request(`/api/user-shows/${showId}`, 'POST', { episodeId: otherEpisodeId, watched: true })).status, 404);
});

test('only the recipient can accept a pending friend request', async () => {
  assert.equal((await owner.request('/api/friendships', 'POST', { targetUserId: bob.id })).status, 200);
  assert.equal((await owner.request('/api/friendships', 'POST', { targetUserId: bob.id, action: 'accept' })).status, 403);
  assert.equal((await other.request('/api/friendships', 'POST', { targetUserId: alice.id, action: 'accept' })).status, 200);
  assert.equal((await prisma.friendship.findFirstOrThrow()).status, 'accepted');
});

test('banner uploads reject HTML, SVG, forged MIME and oversized files; valid images are reencoded', async () => {
  for (const [bytes, type, name] of [
    ['<html>inert</html>', 'text/html', 'test.html'],
    ['<html>inert</html>', 'image/png', 'test.png'],
    ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'image/svg+xml', 'test.svg'],
  ]) {
    const form = new FormData(); form.set('file', new File([bytes], name, { type }));
    assert.equal((await owner.request(`/api/users/${alice.username}/banner`, 'POST', form)).status, 400);
  }
  const large = new FormData(); large.set('file', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));
  assert.equal((await owner.request(`/api/users/${alice.username}/banner`, 'POST', large)).status, 413);
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'red' } }).png().toBuffer();
  const form = new FormData(); form.set('file', new File([new Uint8Array(image)], 'not-trusted.html', { type: 'text/html' }));
  const response = await owner.request(`/api/users/${alice.username}/banner`, 'POST', form);
  assert.equal(response.status, 200);
  const { bannerUrl } = await response.json();
  assert.match(bannerUrl, /^\/uploads\/banner-[\w-]+\.webp$/);
  uploads.push(process.cwd() + '/public' + bannerUrl);
  const served = await guest.request(bannerUrl);
  assert.equal(served.status, 200);
  assert.match(served.headers.get('content-type')!, /image\/webp/);
  assert.equal((await owner.request(`/api/users/${alice.username}/banner`, 'POST', { bannerUrl: 'javascript:alert(1)' })).status, 400);
});

test('all library mutation routes reject invalid scores and statuses before writing', async () => {
  for (const body of [{ score: 999 }, { score: 7.5 }, { score: '9' }, { status: 'unrecognized_status' }]) {
    assert.equal((await owner.request(`/api/user-shows/${showId}`, 'PATCH', body)).status, 400);
    assert.equal((await owner.request('/api/user-shows', 'POST', { showId, ...body })).status, 400);
  }
  assert.equal((await owner.request(`/api/user-shows/${ownLibraryId}/ratings`, 'POST', { score: 7.5 })).status, 400);
  assert.equal((await owner.request(`/api/user-shows/${ownLibraryId}/ratings`, 'POST', { score: 9, episodeId: otherEpisodeId })).status, 404);
  assert.equal((await owner.request(`/api/user-shows/${showId}`, 'PATCH', { score: 9, status: 'completed' })).status, 200);
  assert.equal((await owner.request(`/api/user-shows/${showId}`, 'PATCH', { status: 'watching' })).status, 200);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: ownLibraryId } })).isCompleted, false);
});

function state(round = 1, phase: DuelState['phase'] = 'question', bank = 0): DuelState {
  return { id: randomUUID(), day: new Date().toISOString().slice(0, 10), round, phase, bank, usedIds: [1, 2], leftMovie: { id: 1, title: 'Левый', posterUrl: '/left.jpg', rating: 5, year: '2000' }, rightMovie: { id: 2, title: 'Правый', posterUrl: '/right.jpg', rating: 9, year: '2010' } };
}
async function seedDuel(game: DuelState, attempts = 0) {
  await prisma.user.update({ where: { id: alice.id }, data: { higherLowerState: game, higherLowerAttempts: attempts, higherLowerCompleted: false, lastHigherLowerDate: new Date(), popcorn: 0 } });
}

test('game hides answers and resumes the same server round after reload', async () => {
  const game = state(); await seedDuel(game);
  for (let i = 0; i < 2; i++) {
    const res = await owner.request('/api/higher-lower?round=5'); assert.equal(res.status, 200);
    const data = await res.json(); assert.equal(data.roundId, game.id); assert.equal(data.round, 1);
    assert.equal('rating' in data.rightMovie, false); assert.equal('year' in data.rightMovie, false);
  }
});

test('a correct answer is validated by the server and cannot be replayed', async () => {
  const game = state(); await seedDuel(game);
  assert.equal((await owner.request('/api/higher-lower', 'POST', { action: 'cashout', roundId: game.id, currentBank: 999999 })).status, 400);
  const answer = await owner.request('/api/higher-lower', 'POST', { action: 'answer', roundId: game.id, choice: 'higher', currentBank: 999999 });
  assert.equal(answer.status, 200); const result = await answer.json();
  assert.equal(result.isCorrect, true); assert.equal(result.bank, 1); assert.equal(result.rightMovie.rating, 9);
  assert.equal((await owner.request('/api/higher-lower', 'POST', { action: 'answer', roundId: game.id, choice: 'higher' })).status, 409);
  assert.equal((await other.request('/api/higher-lower', 'POST', { action: 'cashout', roundId: result.roundId })).status, 409);
});

test('parallel cashouts pay the stored bank exactly once and ignore client amounts', async () => {
  const game = state(2, 'answered', 3); await seedDuel(game);
  const responses = await Promise.all(Array.from({ length: 5 }, () => owner.request('/api/higher-lower', 'POST', { action: 'cashout', roundId: game.id, currentBank: 999999 })));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 4);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(user.popcorn, 3); assert.equal(user.higherLowerCompleted, true);
});

test('five rounds produce at most 15 and the last answer pays once', async () => {
  let bank = 0;
  for (let round = 1; round <= 5; round++) bank = answerDuel(state(round, 'question', bank), 'higher').state.bank;
  assert.equal(bank, 15);
  const game = state(5, 'question', 10); await seedDuel(game);
  const responses = await Promise.all([owner.request('/api/higher-lower', 'POST', { action: 'answer', roundId: game.id, choice: 'higher' }), owner.request('/api/higher-lower', 'POST', { action: 'answer', roundId: game.id, choice: 'higher' })]);
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 15);
});

test('wrong answers consume attempts and prevent claiming a lost bank', async () => {
  const game = state(3, 'question', 3); await seedDuel(game, 4);
  const response = await owner.request('/api/higher-lower', 'POST', { action: 'answer', roundId: game.id, choice: 'lower' });
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.phase, 'failed'); assert.equal(result.bank, 0); assert.equal(result.attemptsLeft, 0);
  assert.equal((await owner.request('/api/higher-lower', 'POST', { action: 'cashout', roundId: result.roundId })).status, 409);
  assert.equal((await (await owner.request('/api/higher-lower')).json()).limitReached, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 0);
});

test('expired rounds cannot pay and missing TMDB fails without changing the balance', async () => {
  const game = { ...state(2, 'answered', 3), day: '2000-01-01' }; await seedDuel(game);
  assert.equal((await owner.request('/api/higher-lower', 'POST', { action: 'cashout', roundId: game.id })).status, 409);
  await prisma.user.update({ where: { id: alice.id }, data: { lastHigherLowerDate: new Date('2000-01-01') } });
  assert.equal((await owner.request('/api/higher-lower')).status, 503);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 0);
});

test('the navigation counter endpoint exists and private collections return a handled error', async () => {
  assert.equal((await owner.request('/api/users/counts')).status, 200);
  assert.equal((await owner.request('/api/collections/999999')).status, 404);
});

test('removing a planned title does not move it into watching or delete another user’s library', async () => {
  assert.equal((await guest.request(`/api/user-shows?showId=${showId}`, 'DELETE')).status, 401);
  assert.equal((await owner.request('/api/user-shows', 'POST', { showId, status: 'planned' })).status, 200);
  assert.equal((await owner.request(`/api/user-shows?showId=${showId}`, 'DELETE')).status, 200);
  assert.equal(await prisma.userShow.count({ where: { userId: alice.id, showId } }), 0);
  assert.equal(await prisma.userShow.count({ where: { userId: bob.id, showId } }), 1);
});

async function quickFixture(kind = 'series', totalEpisodes = 2, status = 'watching', episodes = 2) {
  const show = await prisma.show.create({ data: { name: 'Quick progress fixture', kind, countries: [], studios: [], genres: [], creators: [], episodes: { create: Array.from({ length: episodes }, (_, i) => ({ season: 1, episode: i + 1 })) } }, include: { episodes: { orderBy: { episode: 'asc' } } } });
  const entry = await prisma.userShow.create({ data: { userId: alice.id, showId: show.id, kind, status, totalEpisodes, dubbing: 'Сохранить озвучку', isFavorite: true } });
  const path = `/api/user-shows/${entry.id}/quick-progress`;
  const body = { action: 'mark', expectedUpdatedAt: entry.updatedAt.toISOString(), expectedEpisodeId: show.episodes[0]?.id };
  return { show, entry, path, body };
}

test('quick mark and undo restore the previous timestamp and flags exactly', async () => {
  const f = await quickFixture();
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[0].id, stoppedAt: '18:42', watched: false } });
  const response = await fetch(base + f.path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: [...owner.cookies].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify(f.body) });
  assert.equal(response.status, 200); const marked = await response.json();
  assert.equal(marked.item.status, 'watching'); assert.equal(marked.item.progress[0].watched, true); assert.equal(marked.item.progress[0].stoppedAt, null); assert.ok(marked.item.progress[0].watchedAt);
  const undo = await owner.request(f.path, 'POST', { action: 'undo', token: marked.undoToken });
  assert.equal(undo.status, 200);
  const restored = await prisma.episodeProgress.findFirstOrThrow({ where: { userShowId: f.entry.id } });
  assert.equal(restored.watched, false); assert.equal(restored.stoppedAt, '18:42'); assert.equal(restored.watchedAt, null);
  const entry = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } });
  assert.equal(entry.status, 'watching'); assert.equal(entry.isCompleted, false); assert.equal(entry.dubbing, 'Сохранить озвучку'); assert.equal(entry.isFavorite, true);
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: marked.undoToken })).status, 409);
});

test('parallel duplicate marks update one episode only', async () => {
  const f = await quickFixture();
  const responses = await Promise.all(Array.from({ length: 5 }, () => owner.request(f.path, 'POST', f.body)));
  assert.equal(responses.filter(r => r.status === 200).length, 1); assert.equal(responses.filter(r => r.status === 409).length, 4);
  assert.equal(await prisma.episodeProgress.count({ where: { userShowId: f.entry.id, watched: true } }), 1);
  assert.equal((await owner.request(f.path, 'POST', f.body)).status, 409);
});

test('quick progress rejects guests, other owners, wrong episode IDs and cross-origin writes', async () => {
  const f = await quickFixture();
  assert.equal((await guest.request(f.path, 'POST', f.body)).status, 401);
  assert.equal((await other.request(f.path, 'POST', f.body)).status, 404);
  assert.equal((await owner.request(f.path, 'POST', { ...f.body, expectedEpisodeId: otherEpisodeId })).status, 409);
  assert.equal((await owner.request('/api/user-shows/invalid/quick-progress', 'POST', f.body)).status, 400);
  const foreignOrigin = await fetch(base + f.path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: [...owner.cookies].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify(f.body) });
  assert.equal(foreignOrigin.status, 403);
  assert.equal(await prisma.episodeProgress.count({ where: { userShowId: f.entry.id } }), 0);
});

test('last episode completes the series and undo removes only the newly-created progress', async () => {
  const f = await quickFixture('series', 1, 'watching', 1);
  const response = await owner.request(f.path, 'POST', f.body); assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.item.status, 'completed'); assert.equal(result.item.progress.length, 1);
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: result.undoToken })).status, 200);
  assert.equal(await prisma.episodeProgress.count({ where: { userShowId: f.entry.id } }), 0);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).status, 'watching');
});

test('partial catalog data cannot prematurely complete a series or mark an unloaded episode', async () => {
  const f = await quickFixture('series', 2, 'watching', 1);
  // Исторически ошибочная ссылка на серию другого тайтла не завершает этот сериал.
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: otherEpisodeId, watched: true } });
  const response = await owner.request(f.path, 'POST', f.body); assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.item.status, 'watching');
  assert.equal((await owner.request(f.path, 'POST', { ...f.body, expectedUpdatedAt: result.item.updatedAt })).status, 409);
  const unloaded = await quickFixture('series', 10, 'watching', 0);
  assert.equal((await owner.request(unloaded.path, 'POST', unloaded.body)).status, 409);
});

test('movies with or without episode rows support completion and exact undo from planned', async () => {
  for (const episodes of [0, 1]) {
    const f = await quickFixture('movie', 1, 'planned', episodes);
    if (episodes) await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[0].id, stoppedAt: '10:15' } });
    const response = await owner.request(f.path, 'POST', f.body); assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.item.status, 'completed');
    if (episodes) { assert.equal(result.item.progress[0].watched, true); assert.equal(result.item.progress[0].stoppedAt, null); }
    assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: result.undoToken })).status, 200);
    const entry = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id }, include: { progress: true } });
    assert.equal(entry.status, 'planned'); assert.equal(entry.isCompleted, false);
    assert.equal(entry.progress.length, episodes);
    if (episodes) { assert.equal(entry.progress[0].watched, false); assert.equal(entry.progress[0].stoppedAt, '10:15'); }
    assert.equal(await prisma.episode.count({ where: { showId: f.show.id } }), 1);
  }
});

test('undo cannot overwrite later tracker edits, even when parent updatedAt was unchanged', async () => {
  const f = await quickFixture(); const response = await owner.request(f.path, 'POST', f.body); assert.equal(response.status, 200); const result = await response.json();
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[1].id, stoppedAt: '03:00' } });
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: result.undoToken })).status, 409);
  const progress = await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id }, orderBy: { episodeId: 'asc' } });
  assert.equal(progress[0].watched, true); assert.equal(progress[1].stoppedAt, '03:00');
});

test('manual episode routes require the full catalog before completing and preserve watch dates', async () => {
  const f = await quickFixture();
  const first = await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[0].id, stoppedAt: '12:10' } });
  const path = `/api/user-shows/${f.entry.id}/episodes/${first.id}`;
  assert.equal((await owner.request(path, 'PATCH', { watched: true })).status, 200);
  let record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id }, include: { progress: true } });
  assert.equal(record.status, 'watching'); assert.equal(record.isCompleted, false);
  const watchedAt = record.progress[0].watchedAt?.toISOString(); assert.ok(watchedAt); assert.equal(record.progress[0].stoppedAt, null);
  assert.equal((await owner.request(`/api/user-shows/${f.show.id}`, 'POST', { episodeId: f.show.episodes[0].id, watched: true })).status, 200);
  assert.equal((await prisma.episodeProgress.findUniqueOrThrow({ where: { id: first.id } })).watchedAt?.toISOString(), watchedAt);
  assert.equal((await owner.request(`/api/user-shows/${f.show.id}`, 'POST', { episodeId: f.show.episodes[1].id, watched: true })).status, 200);
  record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id }, include: { progress: true } });
  assert.equal(record.status, 'completed'); assert.equal(record.isCompleted, true);
  assert.equal((await owner.request(path, 'PATCH', { watched: false })).status, 200);
  record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id }, include: { progress: true } });
  assert.equal(record.status, 'watching'); assert.equal(record.isCompleted, false);
  assert.equal(record.progress.find(progress => progress.id === first.id)?.watchedAt, null);
});

test('season marks are atomic, complete only the entire show, and clear dates when removed', async () => {
  const f = await quickFixture('series', 4, 'watching', 4);
  await prisma.episode.update({ where: { id: f.show.episodes[2].id }, data: { season: 2, episode: 1 } });
  await prisma.episode.update({ where: { id: f.show.episodes[3].id }, data: { season: 2, episode: 2 } });
  const path = `/api/user-shows/${f.show.id}`;
  const one = await owner.request(path, 'POST', { seasonNumber: 1, markSeasonWatched: true }); assert.equal(one.status, 200);
  assert.equal((await one.json()).item.status, 'watching');
  const two = await owner.request(path, 'POST', { seasonNumber: 2, markSeasonWatched: true }); assert.equal(two.status, 200);
  assert.equal((await two.json()).item.status, 'completed');
  let progress = await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id } });
  assert.equal(progress.length, 4); assert.ok(progress.every(value => value.watched && value.watchedAt && value.stoppedAt === null));
  assert.equal((await owner.request(path, 'POST', { seasonNumber: 1, markSeasonWatched: false })).status, 200);
  const tracker = await (await owner.request(path)).json();
  assert.equal(tracker.userShow.status, 'watching'); assert.equal(tracker.userShow.isCompleted, false); assert.equal(tracker.stats.watchedEpisodesCount, 2); assert.equal(tracker.stats.progressPercent, 50);
  progress = await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id, episodeId: { in: f.show.episodes.slice(0, 2).map(episode => episode.id) } } });
  assert.ok(progress.every(value => !value.watched && value.watchedAt === null));
});

test('explicit completion marks episodes, metadata preserves status, and watching never silently resets progress', async () => {
  const f = await quickFixture('series', 2, 'planned');
  const path = `/api/user-shows/${f.show.id}`;
  assert.equal((await owner.request('/api/user-shows', 'POST', { showId: f.show.id, status: 'completed' })).status, 200);
  const initial = await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id }, orderBy: { episodeId: 'asc' } });
  assert.equal(initial.length, 2); assert.ok(initial.every(progress => progress.watched && progress.watchedAt));
  assert.equal((await owner.request(path, 'PATCH', { status: 'completed' })).status, 200);
  assert.deepEqual((await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id }, orderBy: { episodeId: 'asc' } })).map(progress => progress.watchedAt), initial.map(progress => progress.watchedAt));
  assert.equal((await owner.request('/api/user-shows', 'POST', { showId: f.show.id, score: 8, isFavorite: false })).status, 200);
  let record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } }); assert.equal(record.status, 'completed'); assert.equal(record.isCompleted, true);
  assert.equal((await owner.request(path, 'PATCH', { status: 'watching' })).status, 200);
  record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } }); assert.equal(record.status, 'watching'); assert.equal(record.isCompleted, false);
  assert.equal(await prisma.episodeProgress.count({ where: { userShowId: f.entry.id, watched: true } }), 2);
  assert.equal((await owner.request('/api/wishlist', 'POST', { showId: f.show.id })).status, 200);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).status, 'watching');
});

test('time-only saves preserve status and old dates, and positive progress starts a planned title', async () => {
  const f = await quickFixture('series', 2, 'planned'); const path = `/api/user-shows/${f.show.id}`;
  assert.equal((await owner.request(path, 'POST', { episodeId: f.show.episodes[0].id, stoppedAt: '10:15' })).status, 200);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).status, 'planned');
  assert.equal((await owner.request(path, 'POST', { episodeId: f.show.episodes[0].id, watched: true })).status, 200);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).status, 'watching');
  assert.equal((await owner.request(path, 'POST', { episodeId: f.show.episodes[0].id, stoppedAt: '20:00' })).status, 409);
  const previous = await prisma.episodeProgress.findFirstOrThrow({ where: { userShowId: f.entry.id, episodeId: f.show.episodes[0].id } });
  assert.equal(previous.stoppedAt, null); assert.ok(previous.watchedAt);
  assert.equal((await owner.request(path, 'PATCH', { status: 'dropped' })).status, 200);
  assert.equal((await owner.request(path, 'POST', { episodeId: f.show.episodes[1].id, stoppedAt: '01:02:03' })).status, 200);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).status, 'dropped');
  await prisma.episodeProgress.update({ where: { id: previous.id }, data: { watchedAt: null } });
  assert.equal((await owner.request(path, 'POST', { episodeId: f.show.episodes[0].id, watched: true })).status, 200);
  assert.equal((await prisma.episodeProgress.findUniqueOrThrow({ where: { id: previous.id } })).watchedAt, null);
});

test('invalid progress cannot create a library entry or partially modify a season', async () => {
  const f = await quickFixture(); await prisma.userShow.delete({ where: { id: f.entry.id } });
  const path = `/api/user-shows/${f.show.id}`;
  for (const body of [null, [], {}, { episodeId: f.show.episodes[0].id, watched: 'false' }, { episodeId: f.show.episodes[0].id, watched: 1 }, { episodeId: f.show.episodes[0].id, stoppedAt: '10:99' }, { seasonNumber: 1, markSeasonWatched: 'true' }, { seasonNumber: 1, markSeasonWatched: true, episodeId: f.show.episodes[0].id }]) assert.equal((await owner.request(path, 'POST', body as object)).status, 400);
  assert.equal((await owner.request(path, 'POST', { seasonNumber: 999, markSeasonWatched: true })).status, 404);
  assert.equal((await owner.request(path, 'POST', { episodeId: otherEpisodeId, watched: true })).status, 404);
  assert.equal(await prisma.userShow.count({ where: { userId: alice.id, showId: f.show.id } }), 0);
});

test('missing catalog blocks explicit completion and rolls back all changes', async () => {
  for (const episodes of [0, 1]) {
    const f = await quickFixture('series', 2, 'planned', episodes);
    assert.equal((await owner.request(`/api/user-shows/${f.show.id}`, 'PATCH', { status: 'completed', score: 10 })).status, 409);
    const record = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id }, include: { progress: true, ratings: true } });
    assert.equal(record.status, 'planned'); assert.equal(record.isCompleted, false); assert.equal(record.progress.length, 0); assert.equal(record.ratings.length, 0);
  }
});

test('film completion creates a dated canonical progress and quick marks preserve existing dates', async () => {
  const film = await quickFixture('movie', 1, 'planned', 0);
  const response = await owner.request(`/api/user-shows/${film.show.id}`, 'PATCH', { status: 'completed' }); assert.equal(response.status, 200);
  const record = await prisma.userShow.findUniqueOrThrow({ where: { id: film.entry.id }, include: { progress: true } });
  assert.equal(record.progress.length, 1); assert.ok(record.progress[0].watchedAt); assert.equal(record.progress[0].watched, true);
  const f = await quickFixture('movie', 2, 'watching', 2); const oldDate = new Date('2025-01-02T10:00:00.000Z');
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[0].id, watched: true, watchedAt: oldDate } });
  const quick = await owner.request(f.path, 'POST', f.body); assert.equal(quick.status, 200);
  const progress = await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id }, orderBy: { episodeId: 'asc' } });
  assert.equal(progress[0].watchedAt?.toISOString(), oldDate.toISOString()); assert.ok(progress[1].watchedAt);
});

test('manual writes invalidate an earlier quick undo and concurrent routes remain consistent', async () => {
  const f = await quickFixture();
  const marked = await owner.request(f.path, 'POST', f.body); assert.equal(marked.status, 200); const undo = await marked.json();
  assert.equal((await owner.request(`/api/user-shows/${f.show.id}`, 'POST', { episodeId: f.show.episodes[1].id, watched: true })).status, 200);
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: undo.undoToken })).status, 409);
  const parallel = await quickFixture(); const path = `/api/user-shows/${parallel.show.id}`; const body = { seasonNumber: 1, markSeasonWatched: true };
  const responses = await Promise.all([owner.request(path, 'POST', body), owner.request(parallel.path, 'POST', parallel.body)]);
  assert.ok(responses.every(response => [200, 409].includes(response.status)));
  if (responses[0].status === 409) assert.equal((await owner.request(path, 'POST', body)).status, 200);
  const record = await prisma.userShow.findUniqueOrThrow({ where: { id: parallel.entry.id }, include: { progress: true } });
  assert.equal(record.status, 'completed'); assert.equal(record.isCompleted, true); assert.equal(record.progress.length, 2); assert.ok(record.progress.every(progress => progress.watched && progress.watchedAt));
});

test('friend activity uses catalog totals and excludes progress for another show', async () => {
  const f = await quickFixture('series', 10, 'watching', 2);
  await prisma.episodeProgress.createMany({ data: [{ userShowId: f.entry.id, episodeId: f.show.episodes[0].id, watched: true, watchedAt: new Date() }, { userShowId: f.entry.id, episodeId: otherEpisodeId, watched: true, watchedAt: new Date() }] });
  const response = await other.request('/api/friends/activity'); assert.equal(response.status, 200);
  const activity = (await response.json()).find((entry: { title: { id: number } }) => entry.title.id === f.show.id);
  assert.ok(activity); assert.equal(activity.progress.watched, 1); assert.equal(activity.progress.total, 10);
});

test('profile, achievements and leaderboard agree without counting films or foreign episodes as series', async () => {
  const f = await quickFixture('series', 10, 'dropped', 2);
  await prisma.episodeProgress.createMany({ data: [{ userShowId: f.entry.id, episodeId: f.show.episodes[0].id, watched: true }, { userShowId: f.entry.id, episodeId: otherEpisodeId, watched: true }] });
  const profile = await (await owner.request(`/api/users/${alice.username}`)).json();
  const achievements = await (await owner.request(`/api/users/${alice.username}/achievements`)).json();
  const leaderboard = await (await owner.request('/api/top')).json();
  const top = leaderboard.find((user: { id: string }) => user.id === alice.id);
  const entries = await prisma.userShow.findMany({ where: { userId: alice.id }, include: { show: { include: { episodes: true } }, progress: true } });
  const expected = entries.filter(entry => entry.show.kind === 'series').reduce((sum, entry) => sum + entry.progress.filter(progress => progress.watched && entry.show.episodes.some(episode => episode.id === progress.episodeId)).length, 0);
  for (const id of ['beginner', 'avid', 'marathoner']) {
    const inProfile = profile.achievements.find((achievement: { id: string }) => achievement.id === id);
    const separate = achievements.find((achievement: { id: string }) => achievement.id === id);
    assert.equal(inProfile.current, Math.min(expected, inProfile.target)); assert.equal(separate.current, Math.min(expected, separate.target));
    const inTop = top.achievements.find((achievement: { id: string }) => achievement.id === id);
    if (inTop) assert.equal(inTop.current, Math.min(expected, inTop.target));
  }
  assert.equal(top.completedCount, profile.stats.totalCompleted);
  assert.equal((await (await owner.request(`/api/user-shows/${f.show.id}`)).json()).stats.watchedEpisodesCount, 1);
});

test('large seasons use one atomic save while preserving existing known and unknown dates', async () => {
  const f = await quickFixture('series', 500, 'watching', 500);
  const oldDate = new Date('2025-03-04T10:00:00.000Z');
  await prisma.episodeProgress.createMany({ data: [{ userShowId: f.entry.id, episodeId: f.show.episodes[0].id, watched: true, watchedAt: oldDate }, { userShowId: f.entry.id, episodeId: f.show.episodes[1].id, watched: true, watchedAt: null }] });
  const response = await owner.request(`/api/user-shows/${f.show.id}`, 'POST', { seasonNumber: 1, markSeasonWatched: true });
  assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.item.status, 'completed'); assert.equal(result.item.progress.length, 500);
  assert.equal(result.item.progress.find((progress: { episodeId: number }) => progress.episodeId === f.show.episodes[0].id).watchedAt, oldDate.toISOString());
  assert.equal(result.item.progress.find((progress: { episodeId: number }) => progress.episodeId === f.show.episodes[1].id).watchedAt, null);
  assert.equal(result.item.progress.filter((progress: { watched: boolean; watchedAt: string | null }) => progress.watched && progress.watchedAt).length, 499);
});

test('undo tokens are bound to owner and library record, and modified tokens fail', async () => {
  const f = await quickFixture(); const response = await owner.request(f.path, 'POST', f.body); assert.equal(response.status, 200); const result = await response.json();
  assert.equal((await other.request(f.path, 'POST', { action: 'undo', token: result.undoToken })).status, 400);
  assert.equal((await owner.request(`/api/user-shows/${ownLibraryId}/quick-progress`, 'POST', { action: 'undo', token: result.undoToken })).status, 400);
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: `a${result.undoToken.slice(1)}` })).status, 400);
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: `${result.undoToken}!` })).status, 400);
});

test('undo signatures expire and cannot be verified with a different key', () => {
  const payload: ProgressUndo = { version: 1, userId: 'fixture', userShowId: 1, expiresAt: 2000, before: { status: 'watching', isCompleted: false }, progress: [], fingerprint: 'fixture' };
  const token = signProgressUndo(payload, 'test-only-signing-key');
  assert.ok(verifyProgressUndo(token, 'test-only-signing-key', 1000));
  assert.equal(verifyProgressUndo(token, 'test-only-signing-key', 2000), null);
  assert.equal(verifyProgressUndo(token, 'different-test-key', 1000), null);
});

const calendarToday = () => todayInZone('UTC');
const calendarQuery = () => `from=${addDays(calendarToday(), -7)}&to=${addDays(calendarToday(), 7)}`;

test('calendar dates remain day-only across DST, year boundaries and timezone differences', () => {
  assert.equal(todayInZone('Asia/Yekaterinburg', new Date('2026-10-25T21:00:00Z')), '2026-10-26');
  assert.equal(todayInZone('America/Los_Angeles', new Date('2026-10-26T01:00:00Z')), '2026-10-25');
  assert.deepEqual(calendarRange('2026-11-01', 'week'), { from: '2026-10-26', to: '2026-11-01' });
  assert.deepEqual(calendarRange('2026-10-28', 'month'), { from: '2026-09-28', to: '2026-11-01' });
  assert.equal(addDays('2026-12-31', 1), '2027-01-01'); assert.equal(validDay('2026-02-31'), false);
});

test('calendar, notifications and subscription APIs require auth and validate ranges and input', async () => {
  for (const path of [`/api/calendar?${calendarQuery()}`, '/api/notifications', '/api/release-preferences']) assert.equal((await guest.request(path)).status, 401);
  assert.equal((await guest.request('/api/release-preferences', 'PATCH', { releaseNotificationsEnabled: false })).status, 401);
  assert.equal((await guest.request('/api/notifications', 'PATCH', { all: true, throughId: 0 })).status, 401);
  for (const query of ['from=2026-02-31&to=2026-03-02', 'from=2026-01-01&to=2026-12-31', 'from=2026-10-29&to=2026-10-01', `${calendarQuery()}&status=invalid`]) assert.equal((await owner.request(`/api/calendar?${query}`)).status, 400);
  assert.equal((await owner.request('/api/notifications?timeZone=invalid-zone')).status, 400);
  assert.equal((await owner.request('/api/notifications?cursor=not-a-number')).status, 400);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { notifyNewShows: 'true' })).status, 400);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { userShowId: 1, notifyReleases: 'true' })).status, 400);
  assert.equal((await owner.request(`/api/calendar/sync?${calendarQuery()}`, 'POST', { showIds: [1, 2, 3] })).status, 400);
});

test('calendar is owner-scoped, includes date-only releases and keeps films and unknown dates out', async () => {
  const f = await quickFixture('series', 2, 'watching', 2);
  const today = calendarToday(); await prisma.episode.update({ where: { id: f.show.episodes[0].id }, data: { airDate: dayDate(today) } });
  const hidden = await prisma.show.create({ data: { name: 'Only Bob', kind: 'series', episodes: { create: { season: 1, episode: 1, airDate: dayDate(today) } } } });
  await prisma.userShow.create({ data: { userId: bob.id, showId: hidden.id } });
  const film = await quickFixture('movie', 1, 'watching', 1); await prisma.episode.update({ where: { id: film.show.episodes[0].id }, data: { airDate: dayDate(today) } });
  const response = await owner.request(`/api/calendar?${calendarQuery()}`); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
  const result = await response.json(); const events = result.events.filter((event: { showId: number }) => event.showId === f.show.id);
  assert.equal(events.length, 1); assert.equal(events[0].date, today); assert.equal(events[0].userShowId, f.entry.id);
  assert.equal(result.events.some((event: { showId: number }) => [hidden.id, film.show.id].includes(event.showId)), false);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).updatedAt.toISOString(), f.entry.updatedAt.toISOString());
});

test('subscriptions are owner-scoped, idempotent, reject films and preserve progress revision for undo', async () => {
  const f = await quickFixture();
  const body = { userShowId: f.entry.id, notifyReleases: true, timeZone: 'Asia/Yekaterinburg' };
  assert.equal((await other.request('/api/release-preferences', 'PATCH', body)).status, 404);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', body)).status, 200);
  const first = await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } });
  assert.equal(first.notifyReleases, true); assert.equal(first.notifySince?.toISOString().slice(0, 10), todayInZone('Asia/Yekaterinburg'));
  assert.equal(first.updatedAt.toISOString(), f.entry.updatedAt.toISOString());
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', body)).status, 200);
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: f.entry.id } })).notifySince?.toISOString(), first.notifySince?.toISOString());
  const marked = await owner.request(f.path, 'POST', f.body); assert.equal(marked.status, 200); const token = (await marked.json()).undoToken;
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { ...body, notifyReleases: false })).status, 200);
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token })).status, 200);
  const film = await quickFixture('movie', 1, 'watching', 1);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { ...body, userShowId: film.entry.id })).status, 404);
  const foreignOrigin = await fetch(base + '/api/release-preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: [...owner.cookies].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify(body) });
  assert.equal(foreignOrigin.status, 403);
});

test('release notifications deduplicate, respect subscription start, watched episodes and global disable', async () => {
  const today = calendarToday(); const f = await quickFixture('series', 4, 'watching', 4);
  await prisma.userShow.update({ where: { id: f.entry.id }, data: { notifyReleases: true, notifySince: dayDate(today) } });
  for (const [index, day] of [addDays(today, -1), today, addDays(today, 1), today].entries()) await prisma.episode.update({ where: { id: f.show.episodes[index].id }, data: { airDate: dayDate(day) } });
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[3].id, watched: true } });
  await Promise.all([materializeReleases(alice.id, today, prisma), materializeReleases(alice.id, today, prisma)]);
  let notices = await prisma.releaseNotification.findMany({ where: { userShowId: f.entry.id } });
  assert.equal(notices.length, 1); assert.equal(notices[0].episodeId, f.show.episodes[1].id);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { releaseNotificationsEnabled: false })).status, 200);
  await materializeReleases(alice.id, addDays(today, 1), prisma);
  assert.equal(await prisma.releaseNotification.count({ where: { userShowId: f.entry.id } }), 1);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { releaseNotificationsEnabled: true })).status, 200);
  await materializeReleases(alice.id, addDays(today, 1), prisma);
  notices = await prisma.releaseNotification.findMany({ where: { userShowId: f.entry.id } }); assert.equal(notices.length, 2);
});

test('read state belongs to its owner, bulk read stops at the viewed snapshot, postponed dates are hidden', async () => {
  const today = calendarToday(), f = await quickFixture('series', 3, 'watching', 3);
  await prisma.userShow.update({ where: { id: f.entry.id }, data: { notifyReleases: true, notifySince: dayDate(today) } });
  for (const episode of f.show.episodes) await prisma.episode.update({ where: { id: episode.id }, data: { airDate: dayDate(today) } });
  await materializeReleases(alice.id, today, prisma);
  const rows = await prisma.releaseNotification.findMany({ where: { userShowId: f.entry.id }, orderBy: { id: 'asc' } });
  assert.equal((await other.request('/api/notifications', 'PATCH', { ids: [rows[0].id] })).status, 404);
  assert.equal((await owner.request('/api/notifications', 'PATCH', { all: true, throughId: rows[1].id })).status, 200);
  assert.ok((await prisma.releaseNotification.findUniqueOrThrow({ where: { id: rows[0].id } })).readAt);
  assert.equal((await prisma.releaseNotification.findUniqueOrThrow({ where: { id: rows[2].id } })).readAt, null);
  await prisma.episode.update({ where: { id: f.show.episodes[2].id }, data: { airDate: dayDate(addDays(today, 5)) } });
  let inbox = await (await owner.request('/api/notifications')).json();
  assert.equal(inbox.items.some((item: { id: number }) => item.id === rows[2].id), false);
  await prisma.episode.update({ where: { id: f.show.episodes[2].id }, data: { airDate: dayDate(today) } });
  inbox = await (await owner.request('/api/notifications?mode=unread')).json();
  assert.equal(inbox.items.filter((item: { id: number }) => item.id === rows[2].id).length, 1);
  assert.equal((await owner.request('/api/notifications', 'PATCH', { ids: [rows[2].id] })).status, 200);
  assert.equal((await owner.request('/api/notifications', 'PATCH', { ids: [rows[2].id] })).status, 200);
});

test('new-series default applies to new entries only, including tracker and wishlist entry points', async () => {
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { notifyNewShows: true, timeZone: 'Asia/Yekaterinburg' })).status, 200);
  const existing = await quickFixture(); assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: existing.entry.id } })).notifyReleases, false);
  for (const route of ['metadata', 'tracker', 'wishlist']) {
    const show = await prisma.show.create({ data: { name: `New subscribed ${route}`, kind: 'series' } });
    const response = route === 'metadata' ? await owner.request(`/api/user-shows/${show.id}`, 'PATCH', { status: 'planned' }) : route === 'tracker' ? await owner.request(`/api/user-shows/${show.id}`) : await owner.request('/api/wishlist', 'POST', { showId: show.id });
    assert.equal(response.status, 200);
    const entry = await prisma.userShow.findUniqueOrThrow({ where: { userId_showId: { userId: alice.id, showId: show.id } } });
    assert.equal(entry.notifyReleases, true); assert.ok(entry.notifySince);
  }
  assert.equal((await prisma.userShow.findUniqueOrThrow({ where: { id: existing.entry.id } })).notifyReleases, false);
  assert.equal((await owner.request('/api/release-preferences', 'PATCH', { notifyNewShows: false })).status, 200);
});

test('schedule refresh preserves progress, handles unknown and changed dates, caches calls and survives source failure', async () => {
  const today = calendarToday(), f = await quickFixture();
  await prisma.show.update({ where: { id: f.show.id }, data: { tmdbId: 987654 } });
  const old = await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[0].id, watched: true, watchedAt: new Date('2025-01-02T10:00:00Z') } });
  const show = await prisma.show.findUniqueOrThrow({ where: { id: f.show.id } });
  let calls = 0; const fetcher = async (url: string) => { calls++; assert.match(url, /^https:\/\/api\.themoviedb\.org\/3\/tv\/987654/); return new Response(JSON.stringify(url.includes('/season/') ? { episodes: [{ episode_number: 1, air_date: today, name: 'Episode A' }, { episode_number: 2, air_date: null }] } : { seasons: [{ season_number: 1, episode_count: 2, air_date: addDays(today, -10) }] }), { headers: { 'Content-Type': 'application/json' } }); };
  const range = { from: addDays(today, -7), to: addDays(today, 7) };
  assert.equal((await syncShowSchedule(show, range, { db: prisma, fetcher, apiKey: 'test-only' })).ok, true); assert.equal(calls, 2);
  const updated = await prisma.show.findUniqueOrThrow({ where: { id: show.id } }); assert.equal(scheduleDue(updated, range.from, range.to), false);
  assert.equal((await syncShowSchedule(updated, range, { db: prisma, fetcher, apiKey: 'test-only' })).ok, false); assert.equal(calls, 2);
  assert.deepEqual(await prisma.episodeProgress.findUniqueOrThrow({ where: { id: old.id } }), old);
  assert.equal((await prisma.episode.findUniqueOrThrow({ where: { id: f.show.episodes[0].id } })).airDate?.toISOString().slice(0, 10), today);
  assert.equal((await prisma.episode.findUniqueOrThrow({ where: { id: f.show.episodes[1].id } })).airDate, null);
  assert.equal((await syncShowSchedule(updated, range, { db: prisma, apiKey: 'test-only', now: new Date(Date.now() + 120000), fetcher: async () => new Response('{}', { status: 503 }) })).ok, false);
  assert.equal((await prisma.episode.findUniqueOrThrow({ where: { id: f.show.episodes[0].id } })).airDate?.toISOString().slice(0, 10), today);
  assert.equal((await prisma.show.findUniqueOrThrow({ where: { id: show.id } })).calendarSyncedAt?.toISOString(), updated.calendarSyncedAt?.toISOString());
  assert.equal((await other.request(`/api/calendar/sync?${calendarQuery()}`, 'POST', { showIds: [show.id] })).status, 404);
});

test('notification pagination has no duplicates and never returns another owners inbox', async () => {
  const today = calendarToday(), f = await quickFixture('series', 40, 'watching', 40);
  await prisma.episode.updateMany({ where: { showId: f.show.id }, data: { airDate: dayDate(today) } });
  await prisma.userShow.update({ where: { id: f.entry.id }, data: { notifyReleases: true, notifySince: dayDate(today) } });
  const first = await (await owner.request('/api/notifications')).json();
  assert.equal(first.items.length, 30); assert.ok(first.nextCursor);
  const second = await (await owner.request(`/api/notifications?cursor=${first.nextCursor}`)).json();
  const ids = [...first.items, ...second.items].map((item: { id: number }) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const own = [...first.items, ...second.items].filter((item: { showId: number }) => item.showId === f.show.id); assert.equal(own.length, 40);
  const foreign = await (await other.request('/api/notifications')).json();
  assert.equal(foreign.items.some((item: { showId: number }) => item.showId === f.show.id), false);
});

async function resetCosmetics(balance = 500) {
  await prisma.cosmeticPurchase.deleteMany({ where: { userId: alice.id } });
  await prisma.user.update({ where: { id: alice.id }, data: { popcorn: balance, avatarFrame: 'frame-standard', profileStyle: 'profile-standard' } });
}
const buy = (itemId = 'frame-gold', expectedPrice = 120) => owner.request('/api/cosmetics', 'POST', { action: 'purchase', itemId, expectedPrice });
const equip = (itemId: string) => owner.request('/api/cosmetics', 'POST', { action: 'equip', itemId });

test('cosmetics reject guests, invalid payloads, forged owners and client-supplied prices', async () => {
  await resetCosmetics();
  assert.equal((await guest.request('/api/cosmetics')).status, 401);
  assert.equal((await guest.request('/api/cosmetics', 'POST', { action: 'purchase', itemId: 'frame-gold', expectedPrice: 120 })).status, 401);
  for (const body of [null, [], {}, { action: ['purchase'], itemId: 'frame-standard' }, { action: 'purchase', itemId: 'unknown', expectedPrice: 0 }, { action: 'purchase', itemId: 'frame-gold', expectedPrice: 120, userId: bob.id }, { action: 'purchase', itemId: 'frame-gold', expectedPrice: -10 }]) assert.equal((await owner.request('/api/cosmetics', 'POST', body as object)).status, 400);
  assert.equal((await buy('frame-gold', 0)).status, 409);
  assert.equal((await buy('frame-gold', 1)).status, 409);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 500);
  assert.equal(await prisma.cosmeticPurchase.count({ where: { userId: alice.id } }), 0);
  const response = await owner.request('/api/cosmetics'); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/);
  const snapshot = await response.json(); assert.equal(snapshot.user.id, alice.id); assert.equal('passwordHash' in snapshot.user, false);
  const foreign = await fetch(base + '/api/cosmetics', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: [...owner.cookies].map(([key, value]) => `${key}=${value}`).join('; ') }, body: JSON.stringify({ action: 'purchase', itemId: 'frame-gold', expectedPrice: 120 }) });
  assert.equal(foreign.status, 403);
});

test('purchases debit the server price once and do not silently equip the item', async () => {
  await resetCosmetics(250);
  const response = await buy(); assert.equal(response.status, 200); const first = await response.json();
  assert.equal(first.user.popcorn, 130); assert.equal(first.user.avatarFrame, 'frame-standard'); assert.equal(first.purchase.pricePaid, 120);
  const duplicate = await buy(); assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).alreadyOwned, true);
  assert.equal((await buy('frame-gold', 119)).status, 200, 'already-owned retries never debit even if the quoted price changed');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 130);
  assert.equal(await prisma.cosmeticPurchase.count({ where: { userId: alice.id, itemId: 'frame-gold' } }), 1);
});

test('parallel repeat purchases are idempotent and different items cannot overdraw a balance', async () => {
  await resetCosmetics(300);
  const repeated = await Promise.all(Array.from({ length: 5 }, () => buy()));
  assert.ok(repeated.every(response => response.status === 200));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 180);
  assert.equal(await prisma.cosmeticPurchase.count({ where: { userId: alice.id } }), 1);
  await resetCosmetics(150);
  const different = await Promise.all([buy('frame-pink', 80), buy()]);
  assert.equal(different.filter(response => response.status === 200).length, 1); assert.equal(different.filter(response => response.status === 409).length, 1);
  const receipts = await prisma.cosmeticPurchase.findMany({ where: { userId: alice.id } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(receipts.length, 1); assert.equal(user.popcorn + receipts[0].pricePaid, 150); assert.ok(user.popcorn >= 0);
});

test('failed receipt creation rolls back the balance decrement', async () => {
  await resetCosmetics(400);
  await prisma.cosmeticPurchase.create({ data: { userId: alice.id, itemId: 'test-rollback-anchor', pricePaid: 0 } });
  assert.match(alice.id, /^[a-z0-9]+$/i);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX cosmetic_rollback_test ON "CosmeticPurchase" ("userId") WHERE "userId" = '${alice.id}'`);
  try {
    assert.equal((await buy()).status, 503);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).popcorn, 400);
    assert.equal(await prisma.cosmeticPurchase.count({ where: { userId: alice.id, itemId: 'frame-gold' } }), 0);
  } finally { await prisma.$executeRawUnsafe('DROP INDEX cosmetic_rollback_test'); }
});

test('paid cosmetics require ownership and never read another users collection', async () => {
  await resetCosmetics();
  await prisma.cosmeticPurchase.upsert({ where: { userId_itemId: { userId: bob.id, itemId: 'frame-gold' } }, create: { userId: bob.id, itemId: 'frame-gold', pricePaid: 120 }, update: {} });
  assert.equal((await equip('frame-gold')).status, 403);
  const snapshot = await (await owner.request(`/api/cosmetics?userId=${bob.id}`)).json();
  assert.equal(snapshot.user.id, alice.id); assert.equal(snapshot.purchases.some((purchase: { itemId: string }) => purchase.itemId === 'frame-gold'), false);
  assert.equal((await owner.request('/api/users/me', 'PATCH', { avatarFrame: 'frame-gold', profileStyle: 'profile-wine', popcorn: 999999 })).status, 200);
  const record = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(record.avatarFrame, 'frame-standard'); assert.equal(record.profileStyle, 'profile-standard'); assert.equal(record.popcorn, 500);
});

test('frame and profile slots are independent and switching to standard restores the saved cover', async () => {
  await resetCosmetics(500);
  await prisma.user.update({ where: { id: alice.id }, data: { bannerUrl: 'https://example.test/old-cover.png' } });
  assert.equal((await buy()).status, 200); assert.equal((await buy('profile-wine', 140)).status, 200);
  assert.equal((await equip('frame-gold')).status, 200); assert.equal((await equip('profile-wine')).status, 200);
  let record = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(record.avatarFrame, 'frame-gold'); assert.equal(record.profileStyle, 'profile-wine'); assert.equal(record.bannerUrl, 'https://example.test/old-cover.png');
  assert.equal((await equip('profile-standard')).status, 200);
  record = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(record.profileStyle, 'profile-standard'); assert.equal(record.avatarFrame, 'frame-gold'); assert.equal(record.bannerUrl, 'https://example.test/old-cover.png'); assert.equal(record.popcorn, 240);
  assert.equal((await equip('frame-standard')).status, 200); assert.equal(await prisma.cosmeticPurchase.count({ where: { userId: alice.id } }), 2);
});

test('public profiles and new comments show the selected frame without exposing receipts or balance', async () => {
  await resetCosmetics(); assert.equal((await buy()).status, 200); assert.equal((await equip('frame-gold')).status, 200);
  const profile = await (await guest.request(`/api/users/${alice.username}`)).json();
  assert.equal(profile.user.avatarFrame, 'frame-gold'); assert.equal('cosmeticPurchases' in profile.user, false); assert.equal('popcorn' in profile.user, false);
  const response = await owner.request(`/api/shows/${showId}/comments`, 'POST', { text: 'Cosmetics comment fixture' });
  assert.equal(response.status, 201); assert.equal((await response.json()).user.avatarFrame, 'frame-gold');
  const comments = await (await guest.request(`/api/shows/${showId}/comments`)).json();
  assert.equal(comments.find((comment: { text: string }) => comment.text === 'Cosmetics comment fixture').user.avatarFrame, 'frame-gold');
  const csrf = await (await owner.request('/api/auth/csrf')).json();
  const session = await (await owner.request('/api/auth/session', 'POST', { csrfToken: csrf.csrfToken, data: { user: { id: bob.id, avatarFrame: 'frame-stars' } } })).json();
  assert.equal(session.user.id, alice.id); assert.equal(session.user.avatarFrame, 'frame-gold');
});

test('daily rewards remain single-use under concurrent claims and purchases', async () => {
  await resetCosmetics(75); await prisma.user.update({ where: { id: alice.id }, data: { lastDailyClaim: null, dailyStreak: 0 } });
  const responses = await Promise.all([...Array.from({ length: 5 }, () => owner.request('/api/popcorn', 'POST', { action: 'claim-daily' })), buy('frame-pink', 80)]);
  assert.equal(responses.slice(0, 5).filter(response => response.status === 200).length, 1);
  assert.ok(responses.slice(0, 5).filter(response => response.status !== 200).every(response => response.status === 409));
  const purchased = responses[5].status === 200;
  assert.ok([200, 409].includes(responses[5].status));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(user.popcorn, 85 - (purchased ? 80 : 0)); assert.equal(user.dailyStreak, 1);
  assert.equal(nextDailyStreak(new Date('2026-10-25T01:00:00Z'), 3, new Date('2026-10-27T00:05:00Z')), 1);
  assert.equal(nextDailyStreak(new Date('2026-10-26T23:55:00Z'), 3, new Date('2026-10-27T00:05:00Z')), 4);
});

test('quiz attempt settlement cannot be replayed concurrently or exceed the daily reward cap', async () => {
  await prisma.user.update({ where: { id: alice.id }, data: { popcorn: 0, lastQuizDate: null, quizAttemptsToday: 0 } });
  const original = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  const results = await Promise.all(Array.from({ length: 5 }, () => recordQuizAttempt(original, true, new Date(), prisma)));
  assert.equal(results.filter(Boolean).length, 1);
  for (let i = 0; i < 12; i++) {
    const current = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
    await recordQuizAttempt(current, true, new Date(), prisma);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: alice.id } });
  assert.equal(user.quizAttemptsToday, 10); assert.equal(user.popcorn, 50);
  assert.equal((await owner.request('/api/popcorn', 'POST', { action: 'submit-quiz', targetId: '../account' })).status, 400);
});

test('invalid sessions and sessions of deleted users never fall back to an existing account', async () => {
  const invalid = new Client(); invalid.cookies.set('authjs.session-token', 'invalid-session');
  assert.equal((await invalid.request('/api/users/me')).status, 401);
  await prisma.user.delete({ where: { id: bob.id } });
  assert.equal((await other.request('/api/users/me')).status, 401);
  assert.equal((await other.request('/api/shows')).status, 401);
});

test('TMDB round generation uses authorization, deduplicates movies and hides the new answer', async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.TMDB_API_KEY;
  const oldToken = process.env.TMDB_READ_ACCESS_TOKEN;
  process.env.TMDB_API_KEY = '';
  process.env.TMDB_READ_ACCESS_TOKEN = 'eyJ.test-fixture-only';
  const calls: RequestInit[] = [];
  globalThis.fetch = async (_input, options) => {
    calls.push(options || {});
    return Response.json({ results: [
      { id: 101, title: 'Первый фильм', poster_path: '/one.jpg', vote_average: 5, release_date: '2000-01-01' },
      { id: 102, title: 'Второй фильм', poster_path: '/two.jpg', vote_average: 9, release_date: '2010-01-01' },
    ] });
  };
  try {
    const generated = await createDuel(new Date().toISOString().slice(0, 10), 2, 1);
    assert.equal(calls.length, 2);
    assert.equal((calls[0].headers as Record<string, string>).Authorization, 'Bearer eyJ.test-fixture-only');
    assert.notEqual(generated.leftMovie.id, generated.rightMovie.id);
    assert.equal(generated.round, 2); assert.equal(generated.bank, 1);
    assert.equal('year' in publicDuel(generated, 0).rightMovie, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.TMDB_API_KEY; else process.env.TMDB_API_KEY = oldKey;
    if (oldToken === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN; else process.env.TMDB_READ_ACCESS_TOKEN = oldToken;
  }
});

test('database failures return retryable errors rather than treating a signed-in user as a guest', async () => {
  // Only this suite's isolated temporary schema is affected.
  await prisma.$executeRawUnsafe('ALTER TABLE "User" RENAME TO "User_temporarily_unavailable"');
  try {
    for (const path of ['/api/user-shows?status=library', '/api/popcorn', `/api/users/${alice.username}`]) {
      const response = await owner.request(path);
      assert.equal(response.status, 503, path);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
    }
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "User_temporarily_unavailable" RENAME TO "User"');
  }
  assert.equal((await owner.request('/api/popcorn')).status, 200);
  assert.equal((await owner.request('/api/user-shows?status=library')).status, 200);
});

test('password changes verify the current secret, reject forged owners and serialize concurrent replacements', async () => {
  const account = await prisma.user.create({ data: { username: `password_${randomBytes(5).toString('hex')}`, email: `${randomUUID()}@example.test`, passwordHash: await bcrypt.hash(password, 10) } });
  const client = new Client(); await client.login(account);
  const endpoint = '/api/users/me/password';
  const first = randomBytes(20).toString('hex'), second = randomBytes(20).toString('hex');
  assert.equal((await guest.request(endpoint, 'POST', { currentPassword: password, newPassword: first })).status, 401);
  for (const body of [[], { currentPassword: password, newPassword: first, userId: alice.id }, { currentPassword: password, newPassword: 'short' }, { currentPassword: password, newPassword: 'я'.repeat(37) }])
    assert.equal((await client.request(endpoint, 'POST', body)).status, 400);
  assert.equal((await client.request(endpoint, 'POST', { currentPassword: 'wrong-password', newPassword: first })).status, 400);
  assert.equal((await client.request(endpoint, 'POST', { currentPassword: password, newPassword: password })).status, 400);
  const cookie = [...client.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  assert.equal((await fetch(base + endpoint, { method: 'POST', headers: { cookie, origin: 'https://other.example', 'content-type': 'application/json' }, body: JSON.stringify({ currentPassword: password, newPassword: first }) })).status, 403);
  const results = await Promise.all([first, second].map(newPassword => client.request(endpoint, 'POST', { currentPassword: password, newPassword })));
  assert.equal(results.filter(response => response.status === 200).length, 1);
  assert.ok(results.every(response => [200, 400, 409].includes(response.status)));
  const saved = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(await bcrypt.compare(password, saved.passwordHash!), false);
  const replacement = await bcrypt.compare(first, saved.passwordHash!) ? first : second;
  assert.equal(await bcrypt.compare(replacement, saved.passwordHash!), true);
  assert.equal(await bcrypt.compare(password, (await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).passwordHash!), true);
  for (const [candidate, expected] of [[password, false], [replacement, true]] as const) {
    const login = new Client();
    const csrf = await (await login.request('/api/auth/csrf')).json();
    await login.request('/api/auth/callback/credentials', 'POST', new URLSearchParams({ csrfToken: csrf.csrfToken, email: account.email, password: candidate, callbackUrl: base }));
    const session = await (await login.request('/api/auth/session')).json();
    assert.equal(session?.user?.id === account.id, expected);
  }
});

test('repeated wrong current passwords are limited without changing the stored password', async () => {
  const account = await prisma.user.create({ data: { username: `limited_${randomBytes(5).toString('hex')}`, email: `${randomUUID()}@example.test`, passwordHash: await bcrypt.hash(password, 10) } });
  const client = new Client(); await client.login(account);
  for (let i = 0; i < 5; i++) assert.equal((await client.request('/api/users/me/password', 'POST', { currentPassword: 'wrong-password', newPassword: 'new-test-password' })).status, 400);
  const response = await client.request('/api/users/me/password', 'POST', { currentPassword: password, newPassword: 'new-test-password' });
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.equal(await bcrypt.compare(password, (await prisma.user.findUniqueOrThrow({ where: { id: account.id } })).passwordHash!), true);
});
