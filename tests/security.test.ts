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
    assert.equal(await prisma.episode.count({ where: { showId: f.show.id } }), episodes);
  }
});

test('undo cannot overwrite later tracker edits, even when parent updatedAt was unchanged', async () => {
  const f = await quickFixture(); const response = await owner.request(f.path, 'POST', f.body); assert.equal(response.status, 200); const result = await response.json();
  await prisma.episodeProgress.create({ data: { userShowId: f.entry.id, episodeId: f.show.episodes[1].id, stoppedAt: '03:00' } });
  assert.equal((await owner.request(f.path, 'POST', { action: 'undo', token: result.undoToken })).status, 409);
  const progress = await prisma.episodeProgress.findMany({ where: { userShowId: f.entry.id }, orderBy: { episodeId: 'asc' } });
  assert.equal(progress[0].watched, true); assert.equal(progress[1].stoppedAt, '03:00');
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
