import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

const poster = (id: number) => `/sync-image-${id}.png`;
const movie = (id: number) => ({ id, tmdbId: id, type: 'movie', title: `Фильм ${id}`, originalTitle: 'Film', overview: 'Описание фильма', posterUrl: poster(id), backdropUrl: null, year: '2026', voteAverage: 8, voteCount: 100, genres: ['Драма'] });
const round = (n: number, phase = 'question') => ({ roundId: `round-${n}`, round: n, phase, bank: n - 1, limitReached: false, attemptsLeft: 5, questionType: 'rating', rewardForRound: 1, leftMovie: movie(n * 2 - 1), rightMovie: movie(n * 2) });
async function base(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/auth/session' ? null : {} }));
}
async function images(page: Page, delayed: number[], fail = false) {
  const png = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#bf5e28' } }).png().toBuffer();
  const releases = new Map<number, () => void>();
  await page.route('**/sync-image-*.png', async route => {
    const id = Number(route.request().url().match(/sync-image-(\d+)/)![1]);
    if (delayed.includes(id)) await new Promise<void>(resolve => releases.set(id, resolve));
    if (fail && delayed.includes(id)) return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Unavailable' });
    await route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
  return async (id: number) => { await expect.poll(() => releases.has(id)).toBe(true); releases.get(id)!(); };
}

for (const width of [390, 1440]) test(`roulette waits for the new image before replacing the title at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await base(page); const release = await images(page, [2, 20]); let calls = 0;
  await page.route('**/api/random?*', route => { const item = movie(++calls); return route.fulfill({ json: { randomItem: calls === 2 ? { ...item, backdropUrl: poster(20) } : item } }); });
  await page.goto('/random'); const result = page.locator('.discovery-result');
  await expect(result.getByRole('heading', { name: 'Фильм 1', exact: true })).toBeVisible();
  await result.getByRole('button', { name: /Крутить ещё/ }).click();
  await expect(result).toHaveAttribute('aria-busy', 'true');
  await expect(result.getByRole('heading', { name: 'Фильм 1', exact: true })).toBeVisible();
  await expect(result.getByRole('img', { name: 'Фильм 1', exact: true })).toHaveAttribute('src', poster(1));
  await expect(result.getByRole('button', { name: 'Загрузка…', exact: true })).toBeDisabled();
  await release(2);
  await expect(result.getByRole('heading', { name: 'Фильм 1', exact: true })).toBeVisible();
  await release(20);
  await expect(result.getByRole('heading', { name: 'Фильм 2', exact: true })).toBeVisible();
  expect(await result.getByRole('img', { name: 'Фильм 2', exact: true }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test('quiz keeps the previous frame and answers until the next frame is ready', async ({ page }) => {
  await base(page); const release = await images(page, [2]); let calls = 0, answers = 0;
  await page.route('**/api/popcorn*', route => {
    if (route.request().method() === 'POST') { answers++; return route.fulfill({ json: { isCorrect: true, correctTitle: 'Ответ 1', reward: 1, dailyUsed: 1 } }); }
    if (!route.request().url().includes('get-quiz')) return route.fulfill({ json: {} });
    calls++; return route.fulfill({ json: { roundId: `quiz-${calls}`, backdropUrl: poster(calls), options: [`Ответ ${calls}`, `Другой ${calls}`], dailyUsed: calls, dailyLimit: 10 } });
  });
  await page.goto('/rewards/quiz'); await page.getByRole('button', { name: 'Ответ 1', exact: true }).click();
  await page.getByRole('button', { name: 'Следующий кадр' }).click();
  await expect(page.getByRole('button', { name: '✓ Ответ 1', exact: true })).toBeDisabled();
  await expect(page.getByRole('img', { name: 'Кадр из фильма' })).toHaveAttribute('src', poster(1));
  await expect(page.getByRole('button', { name: 'Ответ 2', exact: true })).toHaveCount(0);
  await release(2);
  await expect(page.getByRole('button', { name: 'Ответ 2', exact: true })).toBeEnabled();
  expect(await page.getByRole('img', { name: 'Кадр из фильма' }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(answers).toBe(1);
});

test('higher-lower changes the whole pair only after both posters are ready', async ({ page }) => {
  await base(page); const release = await images(page, [3, 4]); let nextCalls = 0;
  await page.route('**/api/higher-lower', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: round(1) });
    const action = route.request().postDataJSON().action;
    if (action === 'next') { nextCalls++; return route.fulfill({ json: round(2) }); }
    return route.fulfill({ json: round(1, 'answered') });
  });
  await page.goto('/rewards/higher-lower'); await page.getByRole('button', { name: '▲ ВЫШЕ' }).click();
  const next = page.getByRole('button', { name: /Продолжить → Раунд 2/ }); await next.click();
  await expect(next).toBeDisabled(); await release(3);
  await expect(page.getByRole('heading', { name: 'Фильм 1', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Фильм 3', exact: true })).toHaveCount(0);
  await release(4);
  await expect(page.getByRole('heading', { name: 'Фильм 3', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Фильм 4', exact: true })).toBeVisible();
  for (const id of [3, 4]) expect(await page.getByRole('img', { name: `Фильм ${id}`, exact: true }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(nextCalls).toBe(1);
});

test('failed poster loading preserves the previous roulette card and allows another spin', async ({ page }) => {
  await base(page); const release = await images(page, [2], true); let calls = 0;
  await page.route('**/api/random?*', route => route.fulfill({ json: { randomItem: movie(++calls) } }));
  await page.goto('/random'); const result = page.locator('.discovery-result');
  await expect(result.getByRole('heading', { name: 'Фильм 1', exact: true })).toBeVisible();
  await result.getByRole('button', { name: /Крутить ещё/ }).click(); await release(2);
  await expect(page.getByText('Изображение не загрузилось. Попробуйте ещё раз.', { exact: true })).toBeVisible();
  await expect(result.getByRole('heading', { name: 'Фильм 1', exact: true })).toBeVisible();
  await result.getByRole('button', { name: /Крутить ещё/ }).click();
  await expect(result.getByRole('heading', { name: 'Фильм 3', exact: true })).toBeVisible();
});
